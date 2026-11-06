import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {TilesRenderer} from '3d-tiles-renderer';
import {GoogleCloudAuthPlugin,ReorientationPlugin,TileCompressionPlugin,GLTFExtensionsPlugin} from '3d-tiles-renderer/plugins';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
window.THREE=THREE;window.OrbitControls=OrbitControls;window.TilesRenderer=TilesRenderer;window.GoogleCloudAuthPlugin=GoogleCloudAuthPlugin;window.ReorientationPlugin=ReorientationPlugin;window.TileCompressionPlugin=TileCompressionPlugin;window.GLTFExtensionsPlugin=GLTFExtensionsPlugin;window.DRACOLoader=DRACOLoader;
