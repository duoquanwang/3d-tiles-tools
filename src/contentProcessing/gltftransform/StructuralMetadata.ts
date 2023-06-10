import { ExtensionProperty } from "@gltf-transform/core";
import { Texture } from "@gltf-transform/core";
import { TextureInfo } from "@gltf-transform/core";
import { IProperty } from "@gltf-transform/core";
import { PropertyType } from "@gltf-transform/core";

const NAME = "EXT_structural_metadata";

//============================================================================
// Interfaces for the model classes
// (See `MeshFeatures` for details about the concepts)
//
// NOTE: Even though this is a lot of code, it is rather boilerplate
// code that was created in a very mechanical way. (So much that I
// wondered if it couldn't be auto-generated, but xkcd.com/1319 ).
//
// NOTE: The structures that are defined in the EXT_structural_metadata
// often have a "name" property. This conflicts with the "name" property
// of the "IProperty". So the "name" is referred to as "objectName" here.

interface IStructuralMetadata extends IProperty {
  schema: Schema;
  schemaUri: string;
  propertyTables: PropertyTable[];
  propertyTextures: PropertyTexture[];
  propertyAttributes: PropertyAttribute[];
}
interface ISchema extends IProperty {
  id: string;
  objectName: string;
  description: string;
  version: string;
  classes: { [key: string]: Class };
  enums: { [key: string]: IEnum };
}
interface IClass extends IProperty {
  objectName: string;
  description: string;
  properties: { [key: string]: ClassProperty };
}

/* Not supported by glTF-Transform...
type NumericValue = number | number[] | number[][];
type NoDataValue = number | string | number[] | string[] | number[][];
type AnyValue =
  | number
  | string
  | boolean
  | number[]
  | string[]
  | boolean[]
  | number[][];
*/

interface IClassProperty extends IProperty {
  objectName: string;
  description: string;
  type: string;
  componentType: string;
  enumType: string;
  array: boolean;
  count: number;
  normalized: boolean;
  offset: any;
  scale: any;
  max: any;
  min: any;
  required: boolean;
  noData: any;
  default: any;
}

interface IEnum extends IProperty {
  objectName: string;
  description: string;
  valueType: string;
  values: EnumValue[];
}

interface IEnumValue extends IProperty {
  objectName: string;
  description: string;
  value: number;
}

interface IPropertyTable extends IProperty {
  objectName: string;
  class: string;
  count: number;
  properties: { [key: string]: PropertyTableProperty };
}

interface IPropertyTableProperty extends IProperty {
  // TODO These (values, arrayOffsets, stringOffsets) should
  // be buffer view data, NOT indices!
  values: number;
  arrayOffsets: number;
  stringOffsets: number;
  arrayOffsetType: string;
  stringOffsetType: string;
  offset: any;
  scale: any;
  max: any;
  min: any;
}

interface IPropertyTexture extends IProperty {
  objectName: string;
  class: string;
  properties: { [key: string]: PropertyTextureProperty };
}

interface IPropertyTextureProperty extends IProperty {
  channels: number[];
  offset: any;
  scale: any;
  max: any;
  min: any;
  texture: Texture;
  textureInfo: TextureInfo;
}

interface IPropertyAttribute extends IProperty {
  objectName: string;
  class: string;
  properties: { [key: string]: PropertyAttributeProperty };
}

interface IPropertyAttributeProperty extends IProperty {
  attribute: string;
  offset: any;
  scale: any;
  max: any;
  min: any;
}

// This corresponds to the EXT_structural_metadata.schema.json
// schema, which is structural metadata that can be applied
// to all glTF elements, and is only constrainted to 'nodes' in
// the specification text for now
interface IElementStructuralMetadata extends IProperty {
  propertyTable: PropertyTable;
  index: number;
}

// This corresponds to the mesh.primitive.EXT_structural_metadata.schema.json
// schema
interface IMeshPrimitiveStructuralMetadata extends IProperty {
  propertyTextures: PropertyTexture[];
  propertyAttributes: PropertyAttribute[];
}

//============================================================================

//============================================================================
// The actual model classes
// (See `MeshFeatures` for details about the concepts)
//

export class StructuralMetadata extends ExtensionProperty<IStructuralMetadata> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "StructuralMetadata";
  public declare parentTypes: [PropertyType.ROOT];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "StructuralMetadata";
    this.parentTypes = [PropertyType.ROOT];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      propertyTables: [],
      propertyTextures: [],
      propertyAttributes: [],
    });
  }

  getSchema(): Schema | null {
    return this.getRef("schema");
  }
  setSchema(schema: Schema | null) {
    return this.setRef("schema", schema);
  }

  getSchemaUri(): string {
    return this.get("schemaUri");
  }
  setSchemaUri(name: string) {
    return this.set("schemaUri", name);
  }

  listPropertyTables(): PropertyTable[] {
    return this.listRefs("propertyTables");
  }
  addPropertyTable(propertyTable: PropertyTable) {
    return this.addRef("propertyTables", propertyTable);
  }
  removePropertyTable(propertyTable: PropertyTable) {
    return this.removeRef("propertyTables", propertyTable);
  }

  listPropertyTextures(): PropertyTexture[] {
    return this.listRefs("propertyTextures");
  }
  addPropertyTexture(propertyTexture: PropertyTexture) {
    return this.addRef("propertyTextures", propertyTexture);
  }
  removePropertyTexture(propertyTexture: PropertyTexture) {
    return this.removeRef("propertyTextures", propertyTexture);
  }

  listPropertyAttributes(): PropertyAttribute[] {
    return this.listRefs("propertyAttributes");
  }
  addPropertyAttribute(propertyAttribute: PropertyAttribute) {
    return this.addRef("propertyAttributes", propertyAttribute);
  }
  removePropertyAttribute(propertyAttribute: PropertyAttribute) {
    return this.removeRef("propertyAttributes", propertyAttribute);
  }
}

export class Schema extends ExtensionProperty<ISchema> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "Schema";
  public declare parentTypes: ["StructuralMetadata"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "Schema";
    this.parentTypes = ["StructuralMetadata"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      classes: {},
      enums: {},
    });
  }

  getId(): string {
    return this.get("id");
  }
  setId(name: string) {
    return this.set("id", name);
  }

  getObjectName(): string {
    return this.get("objectName");
  }
  setObjectName(name: string) {
    return this.set("objectName", name);
  }

  getDescription(): string {
    return this.get("description");
  }
  setDescription(description: string) {
    return this.set("description", description);
  }

  getVersion(): string {
    return this.get("version");
  }
  setVersion(version: string) {
    return this.set("version", version);
  }

  setClass(key: string, classValue: Class | null): this {
    return this.setRefMap("classes", key, classValue);
  }
  getClass(key: string): Class | null {
    return this.getRefMap("classes", key);
  }
  listClassKeys(): string[] {
    return this.listRefMapKeys("classes");
  }
  listClassValues(): Class[] {
    return this.listRefMapValues("classes");
  }
}

export class Class extends ExtensionProperty<IClass> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "Class";
  public declare parentTypes: ["Schema"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "Class";
    this.parentTypes = ["Schema"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      properties: {},
    });
  }

  getObjectName(): string {
    return this.get("objectName");
  }
  setObjectName(name: string) {
    return this.set("objectName", name);
  }

  getDescription(): string {
    return this.get("description");
  }
  setDescription(description: string) {
    return this.set("description", description);
  }

  setProperty(key: string, classProperty: ClassProperty | null): this {
    return this.setRefMap("properties", key, classProperty);
  }
  getProperty(key: string): ClassProperty | null {
    return this.getRefMap("properties", key);
  }
  listPropertyKeys(): string[] {
    return this.listRefMapKeys("properties");
  }
  listPropertyValues(): ClassProperty[] {
    return this.listRefMapValues("properties");
  }
}

export class ClassProperty extends ExtensionProperty<IClassProperty> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "ClassProperty";
  public declare parentTypes: ["Class"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "ClassProperty";
    this.parentTypes = ["Class"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      array: false,
      normalized: false,
      required: false,
    });
  }

  getObjectName(): string {
    return this.get("objectName");
  }
  setObjectName(name: string) {
    return this.set("objectName", name);
  }

  getDescription(): string {
    return this.get("description");
  }
  setDescription(description: string) {
    return this.set("description", description);
  }

  getType(): string {
    return this.get("type");
  }
  setType(type: string) {
    return this.set("type", type);
  }

  getComponentType(): string {
    return this.get("componentType");
  }
  setComponentType(componentType: string) {
    return this.set("componentType", componentType);
  }

  getEnumType(): string {
    return this.get("enumType");
  }
  setEnumType(enumType: string) {
    return this.set("enumType", enumType);
  }

  getArray(): boolean {
    return this.get("array");
  }
  setArray(array: boolean) {
    return this.set("array", array);
  }

  getCount(): number {
    return this.get("count");
  }
  setCount(count: number) {
    return this.set("count", count);
  }

  getNormalized(): boolean {
    return this.get("normalized");
  }
  setNormalized(normalized: boolean) {
    return this.set("normalized", normalized);
  }

  getOffset(): any {
    return this.get("offset");
  }
  setOffset(offset: any) {
    return this.set("offset", offset);
  }

  getScale(): any {
    return this.get("scale");
  }
  setScale(scale: any) {
    return this.set("scale", scale);
  }

  getMax(): any {
    return this.get("max");
  }
  setMax(max: any) {
    return this.set("max", max);
  }

  getMin(): any {
    return this.get("min");
  }
  setMin(min: any) {
    return this.set("min", min);
  }

  getRequired(): boolean {
    return this.get("required");
  }
  setRequired(required: boolean) {
    return this.set("required", required);
  }

  getNoData(): any {
    return this.get("noData");
  }
  setNoData(noData: any) {
    return this.set("noData", noData);
  }

  getDefault(): any {
    return this.get("default");
  }
  setDefault(defaultValue: any) {
    return this.set("default", defaultValue);
  }
}

export class Enum extends ExtensionProperty<IEnum> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "Enum";
  public declare parentTypes: ["Schema"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "Enum";
    this.parentTypes = ["Schema"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      valueType: "UINT16",
      values: [],
    });
  }

  getObjectName(): string {
    return this.get("objectName");
  }
  setObjectName(name: string) {
    return this.set("objectName", name);
  }

  getDescription(): string {
    return this.get("description");
  }
  setDescription(description: string) {
    return this.set("description", description);
  }

  getValueType(): string {
    return this.get("valueType");
  }
  setEnumType(valueType: string) {
    return this.set("valueType", valueType);
  }

  listValues(): EnumValue[] {
    return this.listRefs("values");
  }
  addEnumValue(enumValue: EnumValue) {
    return this.addRef("values", enumValue);
  }
  removeEnumValue(enumValue: EnumValue) {
    return this.removeRef("values", enumValue);
  }
}

export class EnumValue extends ExtensionProperty<IEnumValue> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "EnumValue";
  public declare parentTypes: ["Enum"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "EnumValue";
    this.parentTypes = ["Enum"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {});
  }

  getObjectName(): string {
    return this.get("objectName");
  }
  setObjectName(name: string) {
    return this.set("objectName", name);
  }

  getDescription(): string {
    return this.get("description");
  }
  setDescription(description: string) {
    return this.set("description", description);
  }

  getValue(): number {
    return this.get("value");
  }
  setValue(value: number) {
    return this.set("value", value);
  }
}

export class PropertyTable extends ExtensionProperty<IPropertyTable> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "PropertyTable";
  public declare parentTypes: ["StructuralMetadata"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "PropertyTable";
    this.parentTypes = ["StructuralMetadata"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      properties: {},
    });
  }

  getObjectName(): string {
    return this.get("objectName");
  }
  setObjectName(name: string) {
    return this.set("objectName", name);
  }

  getClass(): string {
    return this.get("class");
  }
  setClass(_class: string) {
    return this.set("class", _class);
  }

  getCount(): number {
    return this.get("count");
  }
  setCount(count: number) {
    return this.set("count", count);
  }

  setProperty(key: string, property: PropertyTableProperty | null): this {
    return this.setRefMap("properties", key, property);
  }
  getProperty(key: string): PropertyTableProperty | null {
    return this.getRefMap("properties", key);
  }
  listPropertyKeys(): string[] {
    return this.listRefMapKeys("properties");
  }
  listPropertyValues(): PropertyTableProperty[] {
    return this.listRefMapValues("properties");
  }
}

export class PropertyTableProperty extends ExtensionProperty<IPropertyTableProperty> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "PropertyTableProperty";
  public declare parentTypes: ["PropertyTable"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "PropertyTableProperty";
    this.parentTypes = ["PropertyTable"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      arrayOffsetType: "UINT32",
      stringOffsetType: "UINT32",
    });
  }

  getValues(): number {
    return this.get("values");
  }
  setValues(values: number) {
    return this.set("values", values);
  }

  getArrayOffsets(): number {
    return this.get("arrayOffsets");
  }
  setArrayOffsets(arrayOffsets: number) {
    return this.set("arrayOffsets", arrayOffsets);
  }

  getStringOffsets(): number {
    return this.get("stringOffsets");
  }
  setStringOffsets(stringOffsets: number) {
    return this.set("stringOffsets", stringOffsets);
  }

  getArrayOffsetType(): string {
    return this.get("arrayOffsetType");
  }
  setArrayOffsetType(arrayOffsetType: string) {
    return this.set("arrayOffsetType", arrayOffsetType);
  }

  getStringOffsetType(): string {
    return this.get("stringOffsetType");
  }
  setStringOffsetType(stringOffsetType: string) {
    return this.set("stringOffsetType", stringOffsetType);
  }

  getOffset(): any {
    return this.get("offset");
  }
  setOffset(offset: any) {
    return this.set("offset", offset);
  }

  getScale(): any {
    return this.get("scale");
  }
  setScale(scale: any) {
    return this.set("scale", scale);
  }

  getMax(): any {
    return this.get("max");
  }
  setMax(max: any) {
    return this.set("max", max);
  }

  getMin(): any {
    return this.get("min");
  }
  setMin(min: any) {
    return this.set("min", min);
  }
}

export class PropertyTexture extends ExtensionProperty<IPropertyTexture> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "PropertyTexture";
  public declare parentTypes: ["StructuralMetadata"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "PropertyTexture";
    this.parentTypes = ["StructuralMetadata"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      properties: {},
    });
  }

  getObjectName(): string {
    return this.get("objectName");
  }
  setObjectName(name: string) {
    return this.set("objectName", name);
  }

  getClass(): string {
    return this.get("class");
  }
  setClass(_class: string) {
    return this.set("class", _class);
  }

  setProperty(key: string, property: PropertyTextureProperty | null): this {
    return this.setRefMap("properties", key, property);
  }
  getProperty(key: string): PropertyTextureProperty | null {
    return this.getRefMap("properties", key);
  }
  listPropertyKeys(): string[] {
    return this.listRefMapKeys("properties");
  }
  listPropertyValues(): PropertyTextureProperty[] {
    return this.listRefMapValues("properties");
  }
}

export class PropertyTextureProperty extends ExtensionProperty<IPropertyTextureProperty> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "PropertyTextureProperty";
  public declare parentTypes: ["PropertyTexture"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "PropertyTextureProperty";
    this.parentTypes = ["PropertyTexture"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      channels: [0],
      texture: null,
      textureInfo: new TextureInfo(this.graph, "textureInfo"),
    });
  }

  getChannels(): number[] {
    return this.get("channels");
  }
  setChannels(channels: number[]) {
    return this.set("channels", channels);
  }

  getTexture(): Texture | null {
    return this.getRef("texture");
  }
  setTexture(texture: Texture | null) {
    return this.setRef("texture", texture);
  }

  getTextureInfo(): TextureInfo | null {
    return this.getRef("texture") ? this.getRef("textureInfo") : null;
  }

  getOffset(): any {
    return this.get("offset");
  }
  setOffset(offset: any) {
    return this.set("offset", offset);
  }

  getScale(): any {
    return this.get("scale");
  }
  setScale(scale: any) {
    return this.set("scale", scale);
  }

  getMax(): any {
    return this.get("max");
  }
  setMax(max: any) {
    return this.set("max", max);
  }

  getMin(): any {
    return this.get("min");
  }
  setMin(min: any) {
    return this.set("min", min);
  }
}

export class PropertyAttribute extends ExtensionProperty<IPropertyAttribute> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "PropertyAttribute";
  public declare parentTypes: ["StructuralMetadata"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "PropertyAttribute";
    this.parentTypes = ["StructuralMetadata"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      properties: {},
    });
  }

  getObjectName(): string {
    return this.get("objectName");
  }
  setObjectName(name: string) {
    return this.set("objectName", name);
  }

  getClass(): string {
    return this.get("class");
  }
  setClass(_class: string) {
    return this.set("class", _class);
  }

  setProperty(key: string, property: PropertyAttributeProperty | null): this {
    return this.setRefMap("properties", key, property);
  }
  getProperty(key: string): PropertyAttributeProperty | null {
    return this.getRefMap("properties", key);
  }
  listPropertyKeys(): string[] {
    return this.listRefMapKeys("properties");
  }
  listPropertyValues(): PropertyAttributeProperty[] {
    return this.listRefMapValues("properties");
  }
}

export class PropertyAttributeProperty extends ExtensionProperty<IPropertyAttributeProperty> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "PropertyAttributeProperty";
  public declare parentTypes: ["PropertyAttribute"];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "PropertyAttributeProperty";
    this.parentTypes = ["PropertyAttribute"];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {});
  }

  getAttribute(): string {
    return this.get("attribute");
  }
  setAttribute(attribute: string) {
    return this.set("attribute", attribute);
  }

  getOffset(): any {
    return this.get("offset");
  }
  setOffset(offset: any) {
    return this.set("offset", offset);
  }

  getScale(): any {
    return this.get("scale");
  }
  setScale(scale: any) {
    return this.set("scale", scale);
  }

  getMax(): any {
    return this.get("max");
  }
  setMax(max: any) {
    return this.set("max", max);
  }

  getMin(): any {
    return this.get("min");
  }
  setMin(min: any) {
    return this.set("min", min);
  }
}

export class ElementStructuralMetadata extends ExtensionProperty<IElementStructuralMetadata> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "ElementStructuralMetadata";
  public declare parentTypes: [PropertyType.NODE];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "ElementStructuralMetadata";
    this.parentTypes = [PropertyType.NODE];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {});
  }

  getPropertyTable(): PropertyTable | null {
    return this.getRef("propertyTable");
  }
  setPropertyTable(propertyTable: PropertyTable | null) {
    return this.setRef("propertyTable", propertyTable);
  }

  getIndex(): number {
    return this.get("index");
  }
  setIndex(index: number) {
    return this.set("index", index);
  }
}

export class MeshPrimitiveStructuralMetadata extends ExtensionProperty<IMeshPrimitiveStructuralMetadata> {
  static override EXTENSION_NAME = NAME;
  public declare extensionName: typeof NAME;
  public declare propertyType: "MeshPrimitiveStructuralMetadata";
  public declare parentTypes: [PropertyType.PRIMITIVE];

  protected override init(): void {
    this.extensionName = NAME;
    this.propertyType = "MeshPrimitiveStructuralMetadata";
    this.parentTypes = [PropertyType.PRIMITIVE];
  }

  protected override getDefaults() {
    return Object.assign(super.getDefaults(), {
      propertyTextures: [],
      propertyAttributes: [],
    });
  }

  listPropertyTextures(): PropertyTexture[] {
    return this.listRefs("propertyTextures");
  }
  addPropertyTexture(propertyTexture: PropertyTexture) {
    return this.addRef("propertyTextures", propertyTexture);
  }
  removePropertyTexture(propertyTexture: PropertyTexture) {
    return this.removeRef("propertyTextures", propertyTexture);
  }

  listPropertyAttributes(): PropertyAttribute[] {
    return this.listRefs("propertyAttributes");
  }
  addPropertyAttribute(propertyAttribute: PropertyAttribute) {
    return this.addRef("propertyAttributes", propertyAttribute);
  }
  removePropertyAttribute(propertyAttribute: PropertyAttribute) {
    return this.removeRef("propertyAttributes", propertyAttribute);
  }
}
