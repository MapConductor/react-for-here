// HERE Maps API for JavaScript（グローバル H）の最小限の偽物。
// レンダラーやカメラ処理が触るコンストラクタとメソッドだけを持ち、
// 呼ばれた内容を後から確かめられるように記録する。DOM も Canvas も要らない。

class Point {
    constructor(lat, lng, alt) { this.lat = lat; this.lng = lng; this.alt = alt; }
}

class Rect {
    constructor(top, left, bottom, right) { Object.assign(this, { top, left, bottom, right }); }
    getTopLeft() { return new Point(this.top, this.left); }
    getBottomRight() { return new Point(this.bottom, this.right); }
}

class LineString {
    constructor() { this.points = []; }
    pushPoint(p) { this.points.push(p); }
}

class GeoPolygon {
    constructor(exterior, interiors = []) { this.exterior = exterior; this.interiors = interiors; }
}

class SpatialObject {
    constructor(geometry, options = {}) {
        this.geometry = geometry;
        this.style = { ...(options.style ?? {}) };
        this.zIndex = options.zIndex;
        this.data = options.data;
        this.styleCalls = 0;
    }
    setStyle(style) { this.style = { ...style }; this.styleCalls += 1; }
    setZIndex(z) { this.zIndex = z; }
    getGeometry() { return this.geometry; }
}
class MapPolygon extends SpatialObject {}
class MapPolyline extends SpatialObject {}
class MapMarker extends SpatialObject {}

class Overlay {
    constructor(rect, bitmap, options = {}) {
        this.rect = rect; this.bitmap = bitmap; this.opacity = options.opacity; this.data = options.data;
    }
    setBoundingBox(rect) { this.rect = rect; }
    setBitmap(bitmap) { this.bitmap = bitmap; }
    setOpacity(opacity) { this.opacity = opacity; }
}

class Layer { constructor() { this.kind = 'empty'; } }
class TileLayer extends Layer {
    constructor(provider) { super(); this.kind = 'tile'; this.provider = provider; }
    getProvider() { return this.provider; }
}
class ObjectLayer extends Layer {
    constructor(provider) { super(); this.kind = 'object'; this.provider = provider; }
}

class ImageTileProvider {
    constructor(options) { this.options = options; this.opacity = options.opacity; this.opacityCalls = []; }
    getURL(x, y, z) { return this.options.getURL(x, y, z); }
    setOpacity(opacity) { this.opacity = opacity; this.opacityCalls.push(opacity); }
}

class Group {
    constructor() { this.objects = []; }
    addObject(o) { this.objects.push(o); }
    removeObject(o) { this.objects = this.objects.filter((x) => x !== o); }
}
class LocalObjectProvider {
    constructor() { this.root = new Group(); }
    getRootGroup() { return this.root; }
}

class RasterTileProvider {
    constructor(service, options) { this.service = service; this.options = options; }
}

export function installFakeHere() {
    globalThis.H = {
        geo: { Point, Rect, LineString, Polygon: GeoPolygon },
        math: { Point: class { constructor(x, y) { this.x = x; this.y = y; } } },
        map: {
            Polygon: MapPolygon,
            Polyline: MapPolyline,
            Marker: MapMarker,
            Overlay,
            layer: { Layer, TileLayer, ObjectLayer },
            provider: { ImageTileProvider, LocalObjectProvider },
        },
        service: { rasterTile: { Provider: RasterTileProvider } },
        Map: { EngineType: { P2D: 'P2D' } },
    };
    return globalThis.H;
}

/**
 * map.addObject / addLayer を記録する偽の H.Map。
 * レイヤーは map.getLayers().asArray() の並び（下から上）で持つ。
 */
export function createFakeMap({ baseLayers = [] } = {}) {
    const objects = [];
    const layers = [...baseLayers];
    let lookAt = { position: { lat: 0, lng: 0 }, zoom: 3, heading: 0, tilt: 0 };
    const lookAtCalls = [];
    const listeners = new Map();
    return {
        objects,
        layers,
        lookAtCalls,
        addObject(o) { objects.push(o); },
        removeObject(o) {
            const i = objects.indexOf(o);
            if (i >= 0) objects.splice(i, 1);
        },
        getLayers() { return { asArray: () => [...layers] }; },
        addLayer(layer, index) {
            if (index === undefined) layers.push(layer);
            else layers.splice(index, 0, layer);
        },
        removeLayer(layer) {
            const i = layers.indexOf(layer);
            if (i >= 0) layers.splice(i, 1);
        },
        setBaseLayer(layer) { this.baseLayer = layer; },
        getViewModel() {
            return {
                getLookAtData: () => lookAt,
                setLookAtData: (data, animated) => {
                    lookAtCalls.push({ data, animated });
                    lookAt = { ...lookAt, ...data, position: { ...lookAt.position, ...(data.position ?? {}) } };
                },
            };
        },
        setLookAt(next) { lookAt = next; },
        addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) ?? []), fn]); },
        removeEventListener(name, fn) { listeners.set(name, (listeners.get(name) ?? []).filter((f) => f !== fn)); },
        emit(name) { for (const fn of listeners.get(name) ?? []) fn(); },
        listenerCount(name) { return (listeners.get(name) ?? []).length; },
    };
}

/** `new Image()` の偽物。src を入れると次のマイクロタスクで onload（"bad" を含む URL は onerror）。 */
export function installFakeImage() {
    globalThis.Image = class {
        set src(value) {
            this._src = value;
            queueMicrotask(() => (value.includes('bad') ? this.onerror?.() : this.onload?.()));
        }
        get src() { return this._src; }
    };
}
