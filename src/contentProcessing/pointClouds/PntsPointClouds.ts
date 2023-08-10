import { Iterables } from "../../base/Iterables";

import { PntsFeatureTable } from "../../structure/TileFormats/PntsFeatureTable";
import { BatchTable } from "../../structure/TileFormats/BatchTable";

import { TileFormatError } from "../../tileFormats/TileFormatError";

import { AttributeCompression } from "./AttributeCompression";
import { DefaultPointCloud } from "./DefaultPointCloud";
import { Colors } from "./Colors";

import { TileTableData } from "../../migration/TileTableData";

import { DracoDecoder } from "../draco/DracoDecoder";
import { DracoDecoderResult } from "../draco/DracoDecoderResult";
import { ReadablePointCloud } from "./ReadablePointCloud";
import { BatchTables } from "../../migration/BatchTables";
import { BinaryBodyOffset } from "../../structure/TileFormats/BinaryBodyOffset";

/**
 * Methods to create `ReadablePointCloud` instances from PNTS data
 */
export class PntsPointClouds {
  /**
   * Create a `ReadablePointCloud` from the given PNTS data.
   *
   * This will internally take care of the specific representations
   * of data that PNTS can contain, and always return the data in
   * the form that is described in the `ReadablePointCloud` interface.
   *
   * For example, it will decode quantized positions, oct-encoded
   * normals, and the different color representations, and possible
   * Draco compression, and return the plain, uncompressed data.
   *
   * @param featureTable - The PNTS feature table
   * @param featureTableBinary - The PNTS feature table binary
   * @param batchTable - The PNTS batch table
   * @returns A promise to the `ReadablePointCloud`
   */
  static async create(
    featureTable: PntsFeatureTable,
    featureTableBinary: Buffer,
    batchTable: BatchTable
  ): Promise<ReadablePointCloud> {
    const pointCloud = new DefaultPointCloud();

    // If the feature table contains the 3DTILES_draco_point_compression
    // extension, then uncompress the draco data and assign it as the
    // attributes to the point cloud
    const dracoDecoderResult =
      await PntsPointClouds.obtainDracoDecodedAttributes(
        featureTable,
        featureTableBinary,
        batchTable
      );
    if (dracoDecoderResult) {
      const numPoints = featureTable.POINTS_LENGTH;
      PntsPointClouds.assignDracoDecodedAttributes(
        pointCloud,
        numPoints,
        dracoDecoderResult,
        batchTable
      );
    }

    // Note: The attribute information for things like "POSITION" is
    // basically "invalid" when the 3DTILES_draco_point_compression
    // extension is present. So only assign these when they have NOT
    // yet been assigned from the draco-decoded data.

    // Assign the positions
    if (!pointCloud.getAttributeValues("POSITION")) {
      const positions = PntsPointClouds.createPositions(
        featureTable,
        featureTableBinary
      );
      pointCloud.setPositions(positions);
    }

    // Assign the normals
    if (!pointCloud.getAttributeValues("NORMAL")) {
      const normals = PntsPointClouds.createNormals(
        featureTable,
        featureTableBinary
      );
      if (normals) {
        pointCloud.setNormals(normals);
      }
    }

    // Assign the colors
    if (!pointCloud.getAttributeValues("COLOR_0")) {
      const colors = PntsPointClouds.createNormalizedLinearColors(
        featureTable,
        featureTableBinary
      );
      if (colors) {
        pointCloud.setNormalizedLinearColors(colors);
      }
    }

    // Assign the batch IDs as the "_FEATURE_ID_0" attribute
    if (!pointCloud.getAttributeValues("_FEATURE_ID_0")) {
      const batchIds = PntsPointClouds.createBatchIds(
        featureTable,
        featureTableBinary
      );
      if (batchIds) {
        const componentType =
          PntsPointClouds.obtainBatchIdComponentType(featureTable);
        if (componentType) {
          pointCloud.addAttribute(
            "_FEATURE_ID_0",
            "SCALAR",
            componentType,
            batchIds
          );
        }
      }
    }

    // According to the specification, the global color is only considered
    // when no other color information is present
    if (!pointCloud.getAttributeValues("COLOR_0")) {
      // Assign the global color (from CONSTANT_RGBA)
      const globalColor = PntsPointClouds.createGlobalNormalizedLinearColor(
        featureTable,
        featureTableBinary
      );
      pointCloud.setNormalizedLinearGlobalColor(globalColor);
    }

    // Compute the "global position", including the RTC_CENTER
    // and the quantization offset, if present
    const globalPosition = PntsPointClouds.obtainGlobalPosition(
      featureTable,
      featureTableBinary
    );
    pointCloud.setGlobalPosition(globalPosition);

    return pointCloud;
  }

  /**
   * Returns whether the color information of the point cloud with the
   * given PNTS feature table MAY require an alpha component.
   *
   * This is true for RGBA or CONSTANT_RGBA point clouds, and
   * false otherwise.
   *
   * @param featureTable - The PNTS feature table
   * @returns Whether the point cloud may require an alpha component
   */
  static mayRequireAlpha(featureTable: PntsFeatureTable) {
    // Check the color information presence in the order of prececenc:
    // RGBA, RGB, RGB565, then CONSTANT_RGBA
    if (featureTable.RGBA) {
      return true;
    }
    if (featureTable.RGB) {
      return false;
    }
    if (featureTable.RGB565) {
      return false;
    }
    if (featureTable.CONSTANT_RGBA) {
      return true;
    }
    return false;
  }

  /**
   * Returns whether the point cloud has quantzized positions
   *
   * @param featureTable - The PNTS feature table
   * @returns Whether the point cloud has quantized positions
   */
  static hasQuantizedPositions(featureTable: PntsFeatureTable): boolean {
    if (featureTable.POSITION_QUANTIZED) {
      return true;
    }
    return false;
  }

  /**
   * Returns whether the point cloud has oct-encoded normals
   *
   * @param featureTable - The PNTS feature table
   * @returns Whether the point cloud normals are oct-encoded
   */
  static hasOctEncodedNormals(featureTable: PntsFeatureTable): boolean {
    if (featureTable.NORMAL_OCT16P) {
      return true;
    }
    return false;
  }

  /**
   * Obtain the quantization information from the given PNTS
   * feature table.
   *
   * If the feature table does not contain QUANTIZED_VOLUME_OFFSET
   * or QUANTIZED_VOLUME_SCALE, then `undefined` is returned.
   * Otherwise, the offset and scale are returned.
   *
   * @param featureTable - The PNTS feature table
   * @param featureTableBinary - The PNTS binary
   * @returns The quantization information
   */
  private static obtainQuantizationOffsetScale(
    featureTable: PntsFeatureTable,
    featureTableBinary: Buffer
  ):
    | {
        offset: number[];
        scale: number[];
      }
    | undefined {
    if (!featureTable.QUANTIZED_VOLUME_OFFSET) {
      return undefined;
    }
    if (!featureTable.QUANTIZED_VOLUME_SCALE) {
      return undefined;
    }
    const volumeOffset = TileTableData.obtainNumberArray(
      featureTableBinary,
      featureTable.QUANTIZED_VOLUME_OFFSET,
      3,
      "FLOAT32"
    );
    const volumeScale = TileTableData.obtainNumberArray(
      featureTableBinary,
      featureTable.QUANTIZED_VOLUME_SCALE,
      3,
      "FLOAT32"
    );
    return {
      offset: volumeOffset,
      scale: volumeScale,
    };
  }

  /**
   * If the given feature table defines the 3DTILES_draco_point_compression
   * extension, then decode that data and return it as a `DracoDecoderResult`.
   *
   * The decoded result will include possible draco-encoded properties from
   * the batch table.
   *
   * @param featureTable - The PNTS feature table
   * @param featureTableBinary - The feature table binary
   * @param batchTable - The batch table
   * @returns The `DracoDecoderResult`, or `undefined`
   */
  private static async obtainDracoDecodedAttributes(
    featureTable: PntsFeatureTable,
    featureTableBinary: Buffer,
    batchTable: BatchTable
  ): Promise<DracoDecoderResult | undefined> {
    if (!featureTable.extensions) {
      return undefined;
    }
    const featureTableExtension =
      featureTable.extensions["3DTILES_draco_point_compression"];
    if (!featureTableExtension) {
      return undefined;
    }

    // Collect information about all Draco-encoded properties:
    // These are the properties that are listed in the
    // 3DTILES_draco_point_compression extension of the
    // feature table AND those listed in the extension
    // in the batch table
    const allProperties: { [key: string]: number } = {};
    Object.assign(allProperties, featureTableExtension.properties);
    Object.assign(allProperties, BatchTables.obtainDracoProperties(batchTable));

    const dracoDecoder = await DracoDecoder.create();
    const arrayStart = featureTableExtension.byteOffset;
    const arrayEnd = arrayStart + featureTableExtension.byteLength;
    const buffer = featureTableBinary.subarray(arrayStart, arrayEnd);
    const decoded = dracoDecoder.decodePointCloud(allProperties, buffer);
    return decoded;
  }

  /**
   * Go through all attributes in the given `DracoDecoderResult`,
   * and assign them as attributes to the given point cloud.
   *
   * @param pointCloud - The (default) point cloud to assign the attributes to
   * @param numPoints - The number of points
   * @param dracoDecoderResult - The `DracoDecoderResult` that contains the
   * decoded attributes
   * @param batchTable - The batch table
   */
  private static assignDracoDecodedAttributes(
    pointCloud: DefaultPointCloud,
    numPoints: number,
    dracoDecoderResult: DracoDecoderResult,
    batchTable: BatchTable
  ) {
    // Assign the positions, if present
    const dracoPositions = dracoDecoderResult["POSITION"];
    if (dracoPositions) {
      const positions = PntsPointClouds.createPositionsInternal(
        dracoPositions.attributeData,
        dracoPositions.attributeInfo.byteOffset,
        numPoints
      );
      pointCloud.setPositions(positions);
    }

    // Assign the normals, if present
    const dracoNormals = dracoDecoderResult["NORMAL"];
    if (dracoNormals) {
      const normals = PntsPointClouds.createNormalsInternal(
        dracoNormals.attributeData,
        dracoNormals.attributeInfo.byteOffset,
        numPoints
      );
      pointCloud.setNormals(normals);
    }

    // Assign the colors, from RGB or RGBA data, if present
    const dracoRGB = dracoDecoderResult["RGB"];
    if (dracoRGB) {
      const colorsStandardRGB = PntsPointClouds.createColorsStandardRGBInternal(
        dracoRGB.attributeData,
        dracoRGB.attributeInfo.byteOffset,
        numPoints
      );
      const colorsNormalizedLinearRGBA = Iterables.map(
        colorsStandardRGB,
        Colors.standardRGBToNormalizedLinearRGBA
      );
      pointCloud.setNormalizedLinearColors(colorsNormalizedLinearRGBA);
    }
    const dracoRGBA = dracoDecoderResult["RGBA"];
    if (dracoRGBA) {
      const colorsStandardRGBA =
        PntsPointClouds.createColorsStandardRGBAInternal(
          dracoRGBA.attributeData,
          dracoRGBA.attributeInfo.byteOffset,
          numPoints
        );
      const colorsNormalizedLinearRGBA = Iterables.map(
        colorsStandardRGBA,
        Colors.standardRGBAToNormalizedLinearRGBA
      );
      pointCloud.setNormalizedLinearColors(colorsNormalizedLinearRGBA);
    }

    // Assign the BATCH_ID values as the `_FEATURE_ID_0` attribute, if present
    const dracoBatchId = dracoDecoderResult["BATCH_ID"];
    if (dracoBatchId) {
      const legacyComponentType = dracoBatchId.attributeInfo.componentDatatype;
      const batchIds = PntsPointClouds.createBatchIdsInternal(
        dracoBatchId.attributeData,
        dracoBatchId.attributeInfo.byteOffset,
        legacyComponentType,
        numPoints
      );
      const componentType =
        TileTableData.convertLegacyComponentTypeToComponentType(
          legacyComponentType
        );
      pointCloud.addAttribute(
        "_FEATURE_ID_0",
        "SCALAR",
        componentType,
        batchIds
      );
    }

    // The batch table may contain a 3DTILES_draco_point_compression
    // extension object that defines batch table properties that are
    // draco-compressed. The decoded values of these properties will
    // be part of the dracoDecoderResult, and put into the point
    // cloud as generic attributes here.
    const dracoPropertyNames = BatchTables.obtainDracoPropertyNames(batchTable);
    for (const propertyName of dracoPropertyNames) {
      const dracoProperty = dracoDecoderResult[propertyName];
      if (dracoProperty) {
        const propertyValue = batchTable[propertyName];
        if (TileTableData.isBatchTableBinaryBodyReference(propertyValue)) {
          const legacyType = propertyValue.type;
          const legacyComponentType =
            dracoProperty.attributeInfo.componentDatatype;
          const prpertyValues = TileTableData.createNumericScalarIterable(
            legacyType,
            legacyComponentType,
            dracoProperty.attributeData,
            dracoProperty.attributeInfo.byteOffset,
            numPoints
          );
          const type = TileTableData.convertLegacyTypeToType(legacyType);
          const componentType =
            TileTableData.convertLegacyComponentTypeToComponentType(
              legacyComponentType
            );
          pointCloud.addAttribute(
            propertyName,
            type,
            componentType,
            prpertyValues
          );
        }
      }
    }
  }

  /**
   * Create the BATCH_ID data from the given feature table data,
   * or undefined if there is no BATCH_ID information.
   *
   * @param featureTable - The PNTS feature table
   * @param binary - The feature table binary
   * @returns The batch IDs
   */
  private static createBatchIds(
    featureTable: PntsFeatureTable,
    binary: Buffer
  ): Iterable<number> | undefined {
    const batchId = featureTable.BATCH_ID;
    if (!batchId) {
      return undefined;
    }
    const batchLength = featureTable.BATCH_LENGTH;
    if (batchLength === undefined) {
      throw new TileFormatError("Found BATCH_ID but no BATCH_LENGTH");
    }
    const numPoints = featureTable.POINTS_LENGTH;
    const legacyComponentType = batchId.componentType ?? "UNSIGNED_SHORT";
    const batchIds = PntsPointClouds.createBatchIdsInternal(
      binary,
      batchId.byteOffset,
      legacyComponentType,
      numPoints
    );
    return batchIds;
  }

  /**
   * Obtain the component type of the BATCH_ID data (if present).
   * This will be a string like `"UINT8"` or `"FLOAT32"`.
   *
   * @param featureTable - The PNTS feature table
   * @returns The BATCH_ID component type
   */
  private static obtainBatchIdComponentType(
    featureTable: PntsFeatureTable
  ): string | undefined {
    const batchId = featureTable.BATCH_ID;
    if (!batchId) {
      return undefined;
    }
    const legacyComponentType = batchId.componentType ?? "UNSIGNED_SHORT";
    const componentType =
      TileTableData.convertLegacyComponentTypeToComponentType(
        legacyComponentType
      );
    return componentType;
  }

  /**
   * Create the position data from the given feature table data.
   *
   * This will return the POSITION or POSITION_QUANTIZED data
   * as an iterable over 3D float arrays. The actual positions
   * of the points returned will be relative to the position
   * that is returned by `obtainGlobalPosition`
   *
   * @param featureTable - The PNTS feature table
   * @param binary - The feature table binary
   * @returns The the iterable over the data
   */
  private static createPositions(
    featureTable: PntsFeatureTable,
    binary: Buffer
  ): Iterable<number[]> {
    const numPoints = featureTable.POINTS_LENGTH;
    if (featureTable.POSITION) {
      const byteOffset = featureTable.POSITION.byteOffset;
      return PntsPointClouds.createPositionsInternal(
        binary,
        byteOffset,
        numPoints
      );
    }

    if (featureTable.POSITION_QUANTIZED) {
      const quantization = PntsPointClouds.obtainQuantizationOffsetScale(
        featureTable,
        binary
      );

      if (!quantization) {
        throw new TileFormatError(
          `The feature table contains POSITION_QUANTIZED, but not ` +
            `QUANTIZED_VOLUME_OFFSET and QUANTIZED_VOLUME_OFFSET`
        );
      }
      const byteOffset = featureTable.POSITION_QUANTIZED.byteOffset;
      const quantizedPositions =
        PntsPointClouds.createQuantizedPositionsInternal(
          binary,
          byteOffset,
          numPoints
        );
      // The 'quantization.offset' will become part of the 'global position'
      // of the point cloud, so use an offset of [0,0,0] here
      const offset = [0, 0, 0];
      const dequantization = PntsPointClouds.createDequantization(
        offset,
        quantization.scale
      );
      return Iterables.map(quantizedPositions, dequantization);
    }

    throw new TileFormatError(
      "The feature table contains neither POSITION nor POSITION_QUANTIZED"
    );
  }

  /**
   * Returns the "global position" of the point cloud.
   *
   * The position information of the point cloud will be _relative_ to this
   * position. It will include the RTC_CENTER (if present) and the
   * quantization offset (if present), and will be `undefined` if neither
   * of them is present.
   *
   * @param featureTable - The feature table
   * @param featureTableBinary - The feature tabel binary
   * @returns The global position
   */
  private static obtainGlobalPosition(
    featureTable: PntsFeatureTable,
    featureTableBinary: Buffer
  ): [number, number, number] | undefined {
    // Compute the "global position" of the point cloud. This may
    // include the RTC_CENTER and the quantization offset.
    let globalPosition: [number, number, number] | undefined = undefined;

    // Fetch the `RTC_CENTER` from the feature table, to be used
    // as the "global position" of the point cloud
    if (featureTable.RTC_CENTER) {
      const rtcCenter = TileTableData.obtainRtcCenter(
        featureTable.RTC_CENTER,
        featureTableBinary
      );
      // Take the y-up-vs-z-up transform into account:
      globalPosition = [rtcCenter[0], rtcCenter[2], -rtcCenter[1]];
    }

    // Add the quantization offset to the global position
    const quantization = PntsPointClouds.obtainQuantizationOffsetScale(
      featureTable,
      featureTableBinary
    );
    if (quantization) {
      if (!globalPosition) {
        globalPosition = [0, 0, 0];
      }
      // Take the y-up-vs-z-up transform into account:
      globalPosition[0] += quantization.offset[0];
      globalPosition[1] += quantization.offset[2];
      globalPosition[2] += -quantization.offset[1];
    }
    return globalPosition;
  }

  /**
   * Create the normal data from the given feature table data.
   *
   * This will return the NORMAL or NORMAL_OCT16P data
   * as an iterable over 3D float arrays.
   *
   * @param featureTable - The PNTS feature table
   * @param binary - The feature table binary
   * @returns The the iterable over the data
   */
  private static createNormals(
    featureTable: PntsFeatureTable,
    binary: Buffer
  ): Iterable<number[]> | undefined {
    const numPoints = featureTable.POINTS_LENGTH;
    if (featureTable.NORMAL) {
      const byteOffset = featureTable.NORMAL.byteOffset;
      return PntsPointClouds.createNormalsInternal(
        binary,
        byteOffset,
        numPoints
      );
    }

    if (featureTable.NORMAL_OCT16P) {
      const byteOffset = featureTable.NORMAL_OCT16P.byteOffset;
      const octEncodedNormals = PntsPointClouds.createOctEncodedNormalsInternal(
        binary,
        byteOffset,
        numPoints
      );
      const normals = Iterables.map(
        octEncodedNormals,
        AttributeCompression.octDecode
      );
      return normals;
    }
    return undefined;
  }

  /**
   * Create the color data from the given feature table data.
   *
   * This will return the RGB or RGBA or RGB565 data
   * as an iterable over 4D float arrays, containing
   * the linear RGBA colors with components in [0.0, 1.0].
   *
   * @param featureTable - The PNTS feature table
   * @param binary - The feature table binary
   * @returns The the iterable over the data
   */
  private static createNormalizedLinearColors(
    featureTable: PntsFeatureTable,
    binary: Buffer
  ): Iterable<number[]> | undefined {
    // According to the specification, the precedence for considering the
    // color information is RGBA, RGB, RGB565 (and later: CONSTANT_RGBA)

    const numPoints = featureTable.POINTS_LENGTH;
    if (featureTable.RGBA) {
      const byteOffset = featureTable.RGBA.byteOffset;
      const colorsStandardRGBA =
        PntsPointClouds.createColorsStandardRGBAInternal(
          binary,
          byteOffset,
          numPoints
        );
      const colorsNormalizedLinearRGBA = Iterables.map(
        colorsStandardRGBA,
        Colors.standardRGBAToNormalizedLinearRGBA
      );
      return colorsNormalizedLinearRGBA;
    }
    if (featureTable.RGB) {
      const byteOffset = featureTable.RGB.byteOffset;
      const colorsStandardRGB = PntsPointClouds.createColorsStandardRGBInternal(
        binary,
        byteOffset,
        numPoints
      );
      const colorsNormalizedLinearRGBA = Iterables.map(
        colorsStandardRGB,
        Colors.standardRGBToNormalizedLinearRGBA
      );
      return colorsNormalizedLinearRGBA;
    }
    if (featureTable.RGB565) {
      const byteOffset = featureTable.RGB565.byteOffset;
      const colorsStandardRGB565 =
        PntsPointClouds.createColorsStandardRGB656Internal(
          binary,
          byteOffset,
          numPoints
        );
      const colorsNormalizedLinearRGBA = Iterables.map(
        colorsStandardRGB565,
        Colors.standardRGB565ToNormalizedLinearRGBA
      );
      return colorsNormalizedLinearRGBA;
    }
    return undefined;
  }

  /**
   * Obtain the global color data from the given feature table data.
   *
   * This will return the CONSTANT_RGBA value, as a 4D float array,
   * containing the linear RGBA color with components in [0.0, 1.0].
   *
   * @param featureTable - The PNTS feature table
   * @param binary - The feature table binary
   * @returns The global color
   */
  private static createGlobalNormalizedLinearColor(
    featureTable: PntsFeatureTable,
    binary: Buffer
  ): [number, number, number, number] | undefined {
    if (!featureTable.CONSTANT_RGBA) {
      return undefined;
    }
    const constantRGBA = TileTableData.obtainNumberArray(
      binary,
      featureTable.CONSTANT_RGBA,
      4,
      "UNSIGNED_BYTE"
    );
    const normalizedLinearRGBA =
      Colors.standardRGBAToNormalizedLinearRGBA(constantRGBA);
    return [
      normalizedLinearRGBA[0],
      normalizedLinearRGBA[1],
      normalizedLinearRGBA[2],
      normalizedLinearRGBA[3],
    ];
  }

  /**
   * Create the position data from the given data
   *
   * @param binary - The feature table binary
   * @param byteOffset - The byte offset
   * @param numPoints - The number of points
   * @returns The the iterable over the data
   */
  private static createPositionsInternal(
    binary: Buffer,
    byteOffset: number,
    numPoints: number
  ): Iterable<number[]> {
    const legacyType = "VEC3";
    const legacyComponentType = "FLOAT";
    return TileTableData.createNumericArrayIterable(
      legacyType,
      legacyComponentType,
      binary,
      byteOffset,
      numPoints
    );
  }

  /**
   * Create the quantized positions data from the given data
   *
   * @param binary - The feature table binary
   * @param byteOffset - The byte offset
   * @param numPoints - The number of points
   * @returns The the iterable over the data
   */
  private static createQuantizedPositionsInternal(
    binary: Buffer,
    byteOffset: number,
    numPoints: number
  ): Iterable<number[]> {
    const legacyType = "VEC3";
    const legacyComponentType = "UNSIGNED_SHORT";
    return TileTableData.createNumericArrayIterable(
      legacyType,
      legacyComponentType,
      binary,
      byteOffset,
      numPoints
    );
  }

  /**
   * Create the normal data from the given data
   *
   * @param binary - The feature table binary
   * @param byteOffset - The byte offset
   * @param numPoints - The number of points
   * @returns The the iterable over the data
   */
  private static createNormalsInternal(
    binary: Buffer,
    byteOffset: number,
    numPoints: number
  ): Iterable<number[]> {
    const legacyType = "VEC3";
    const legacyComponentType = "FLOAT";
    return TileTableData.createNumericArrayIterable(
      legacyType,
      legacyComponentType,
      binary,
      byteOffset,
      numPoints
    );
  }

  /**
   * Create the oct-encoded normal data from the given data
   *
   * @param binary - The feature table binary
   * @param byteOffset - The byte offset
   * @param numPoints - The number of points
   * @returns The the iterable over the data
   */
  private static createOctEncodedNormalsInternal(
    binary: Buffer,
    byteOffset: number,
    numPoints: number
  ): Iterable<number[]> {
    const legacyType = "VEC2";
    const legacyComponentType = "UNSIGNED_BYTE";
    return TileTableData.createNumericArrayIterable(
      legacyType,
      legacyComponentType,
      binary,
      byteOffset,
      numPoints
    );
  }

  /**
   * Create the RGB color data from the given data
   *
   * @param binary - The feature table binary
   * @param byteOffset - The byte offset
   * @param numPoints - The number of points
   * @returns The the iterable over the data
   */
  private static createColorsStandardRGBInternal(
    binary: Buffer,
    byteOffset: number,
    numPoints: number
  ): Iterable<number[]> {
    const legacyType = "VEC3";
    const legacyComponentType = "UNSIGNED_BYTE";
    return TileTableData.createNumericArrayIterable(
      legacyType,
      legacyComponentType,
      binary,
      byteOffset,
      numPoints
    );
  }

  /**
   * Create the RGBA color data from the given data
   *
   * @param binary - The feature table binary
   * @param byteOffset - The byte offset
   * @param numPoints - The number of points
   * @returns The the iterable over the data
   */
  private static createColorsStandardRGBAInternal(
    binary: Buffer,
    byteOffset: number,
    numPoints: number
  ): Iterable<number[]> {
    const legacyType = "VEC4";
    const legacyComponentType = "UNSIGNED_BYTE";
    return TileTableData.createNumericArrayIterable(
      legacyType,
      legacyComponentType,
      binary,
      byteOffset,
      numPoints
    );
  }

  /**
   * Create the RGB565 color data from the given data
   *
   * @param binary - The feature table binary
   * @param byteOffset - The byte offset
   * @param numPoints - The number of points
   * @returns The the iterable over the data
   */
  private static createColorsStandardRGB656Internal(
    binary: Buffer,
    byteOffset: number,
    numPoints: number
  ): Iterable<number> {
    const legacyType = "SCALAR";
    const legacyComponentType = "UNSIGNED_SHORT";
    return TileTableData.createNumericScalarIterable(
      legacyType,
      legacyComponentType,
      binary,
      byteOffset,
      numPoints
    );
  }

  /**
   * Create the batch ID data from the given data
   *
   * @param binary - The feature table binary
   * @param byteOffset - The byte offset
   * @param legacyComponentType - The (legacy) component type
   * (e.g. "UNSIGNED_BYTE" - not "UINT8")
   * @param numPoints - The number of points
   * @returns The iterable over the result values
   */
  private static createBatchIdsInternal(
    binary: Buffer,
    byteOffset: number,
    legacyComponentType: string,
    numPoints: number
  ): Iterable<number> {
    const batchIds = TileTableData.createNumericScalarIterable(
      "SCALAR",
      legacyComponentType,
      binary,
      byteOffset,
      numPoints
    );
    return batchIds;
  }

  /**
   * Creates a function that receives a 3D point and returns a 3D
   * point, applying the dequantization of
   * ```
   * POSITION = POSITION_QUANTIZED * QUANTIZED_VOLUME_SCALE / 65535.0 + QUANTIZED_VOLUME_OFFSET
   * ```
   * as described in the specification.
   *
   * @param volumeOffset - The volume offset
   * @param volumeScale - The volume scale
   * @returns The dequantization function
   */
  private static createDequantization(
    volumeOffset: number[],
    volumeScale: number[]
  ): (input: number[]) => number[] {
    const scaleX = volumeScale[0] / 65535.0;
    const scaleY = volumeScale[1] / 65535.0;
    const scaleZ = volumeScale[2] / 65535.0;
    const offsetX = volumeOffset[0];
    const offsetY = volumeOffset[1];
    const offsetZ = volumeOffset[2];
    return (input: number[]) => {
      const output = [
        input[0] * scaleX + offsetX,
        input[1] * scaleY + offsetY,
        input[2] * scaleZ + offsetZ,
      ];
      return output;
    };
  }
}
