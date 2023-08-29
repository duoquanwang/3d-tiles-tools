import { Tile } from "../../structure/Tile";
import { Tileset } from "../../structure/Tileset";
import { Content } from "../../structure/Content";

import { Tiles } from "../../tilesets/Tiles";
import { Extensions } from "../../tilesets/Extensions";

import { TilesetUpgradeOptions } from "./TilesetUpgradeOptions";

/**
 * A class for "upgrading" the `Tileset` object that was parsed from
 * a tileset JSON, from a previous version to a more recent version.
 * The details of what that means exactly are not (yet) specified.
 *
 * @internal
 */
export class TilesetObjectUpgrader {
  /**
   * A function that will receive log messages during the upgrade process
   */
  private readonly logCallback: (message: any) => void;

  /**
   * The options for the upgrade.
   */
  private readonly upgradeOptions: TilesetUpgradeOptions;

  /**
   * Creates a new instance
   *
   * @param upgradeOptions - The `UpgradeOptions`
   * @param logCallback - The log callback
   */
  constructor(
    upgradeOptions: TilesetUpgradeOptions,
    logCallback: (message: any) => void
  ) {
    this.upgradeOptions = upgradeOptions;
    this.logCallback = logCallback;
  }

  /**
   * Upgrades the given tileset, in place.
   *
   * @param tileset - The parsed tileset
   */
  async upgradeTilesetObject(tileset: Tileset): Promise<void> {
    if (this.upgradeOptions.upgradedAssetVersionNumber) {
      this.logCallback(`Upgrading asset version number`);
      this.upgradeAssetVersionNumber(
        tileset,
        this.upgradeOptions.upgradedAssetVersionNumber
      );
    }
    if (this.upgradeOptions.upgradeRefineCase) {
      this.logCallback(`Upgrading refine to be in uppercase`);
      await this.upgradeRefineValues(tileset);
    }
    if (this.upgradeOptions.upgradeContentUrlToUri) {
      this.logCallback(`Upgrading content.url to content.uri`);
      await this.upgradeEachContentUrlToUri(tileset);
    }
    if (this.upgradeOptions.upgradeContentGltfExtensionDeclarations) {
      this.logCallback(`Upgrading extension declarations`);
      Extensions.removeExtensionUsed(tileset, "3DTILES_content_gltf");
    }
  }

  /**
   * Upgrade the `asset.version` number in the given tileset
   * to be the given target version
   *
   * @param tileset - The tileset
   * @param targetVersion - The target version
   */
  private upgradeAssetVersionNumber(tileset: Tileset, targetVersion: string) {
    if (tileset.asset.version !== targetVersion) {
      this.logCallback(
        `  Upgrading asset version from ${tileset.asset.version} to ${targetVersion}`
      );
      tileset.asset.version = targetVersion;
    }
  }

  /**
   * Upgrade the `url` property of each tile content to `uri`.
   *
   * This will examine each `tile.content` in the explicit representation
   * of the tile hierarchy in the given tileset. If any content does not
   * define a `uri`, but a (legacy) `url` property, then the `url` is
   * renamed to `uri`.
   *
   * @param tileset - The tileset
   */
  private async upgradeEachContentUrlToUri(tileset: Tileset) {
    const root = tileset.root;
    await Tiles.traverseExplicit(root, async (tilePath: Tile[]) => {
      const tile = tilePath[tilePath.length - 1];
      if (tile.content) {
        this.upgradeContentUrlToUri(tile.content);
      }
      if (tile.contents) {
        for (const content of tile.contents) {
          this.upgradeContentUrlToUri(content);
        }
      }
      return true;
    });
  }

  /**
   * If the given `Content` does not have a `uri` but uses the
   * legacy `url` property, then a message is logged, and the
   * `url` property is renamed to `uri`.
   *
   * @param content - The `Content`
   */
  private upgradeContentUrlToUri(content: Content): void {
    if (content.uri) {
      return;
    }
    const legacyContent = content as any;
    if (legacyContent.url) {
      this.logCallback(
        `  Renaming 'url' property for content ${legacyContent.url} to 'uri'`
      );
      content.uri = legacyContent.url;
      delete legacyContent.url;
      return;
    }
    // This should never be the case:
    this.logCallback(
      "  The content does not have a 'uri' property (and no legacy 'url' property)"
    );
  }

  /**
   * Upgrade the `refine` property of each tile to be written in
   * uppercase letters.
   *
   * @param tileset - The tileset
   */
  private async upgradeRefineValues(tileset: Tileset) {
    const root = tileset.root;
    await Tiles.traverseExplicit(root, async (tilePath: Tile[]) => {
      const tile = tilePath[tilePath.length - 1];
      if (tile.refine && tile.refine !== "ADD" && tile.refine !== "REPLACE") {
        const oldValue = tile.refine;
        const newValue = oldValue.toUpperCase();
        this.logCallback(
          `  Renaming 'refine' value from ${oldValue} to ${newValue}`
        );
        tile.refine = newValue;
      }
      return true;
    });
  }
}