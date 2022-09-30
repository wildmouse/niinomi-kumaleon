const vertexShader = `
precision mediump float;

attribute float index;
attribute float totalIndex;
attribute vec3 position;
attribute vec2 uv;
attribute vec2 size;
attribute vec2 offset;
attribute vec2 padding;
attribute vec3 bgColor;
attribute vec3 textColor;
attribute float direction;
attribute float ratio;
attribute vec2 weight;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform float uWidth;
uniform float uHeight;
uniform float duration;

varying float vIndex;
varying float vTotalIndex;
varying vec2 vUv;
varying vec3 vBgColor;
varying vec3 vTextColor;
varying vec2 vResolution;
varying float vDirection;
varying float vRatio;
varying vec2 vWeight;

void main() {
    vIndex = index;
    vTotalIndex = totalIndex;
    vUv = uv;
    vBgColor = bgColor;
    vTextColor = textColor;
    vResolution = vec2(size.x - padding.x, size.y - padding.y);
    vDirection = direction;
    vRatio = ratio;
    vWeight = weight;

    float t = time / duration;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    mvPosition.xy += offset * vResolution;

    gl_Position = projectionMatrix * mvPosition;
}`

const fragmentShader = `
precision mediump float;

const float PI = 3.1415926535897932384626433832795;

uniform vec2 resolution;
uniform float time;
uniform sampler2D texture;
uniform vec2 textureResolution;
uniform float textureBlockSize;

varying float vIndex;
varying float vTotalIndex;
varying vec2 vUv;
varying vec3 vBgColor;
varying vec3 vTextColor;
varying vec2 vResolution;
varying float vDirection;
varying float vRatio;
varying vec2 vWeight;

float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float atan2(float y, float x){
    return x == 0.0 ? sign(y) * PI / 2.0 : atan(y, x);
}

/**
 * Reference
 * https://karanokan.info/2019/03/31/post-2465
 */
float polygon(vec2 p, float n, float size){
    float a = atan2(p.x, p.y) + PI;
    float r = 2.0 * PI / n;
    return cos(floor(0.5 + a / r) * r - a) * length(p) - size;
}

vec2 getUVForTexture (vec2 uv, float t) {
    float count = textureBlockSize;
    vec2 pos = vec2(
        floor(fract(t) * count),
        floor(mod(t, count))
    );
    vec2 eachSize = textureResolution / count / textureResolution;
    vec2 ff = vec2(pos.x, pos.y);

    return vec2(
        uv.x * eachSize.x + eachSize.x * ff.x,
        uv.y * eachSize.y + (1.0 - eachSize.y) - eachSize.y * ff.y
    );
}

float getTypePos(float index) {
    return index / textureBlockSize;
}

void main() {
    vec2 uv = (vUv.xy * vResolution * 2.0 - vResolution.xy) / min(vResolution.x, vResolution.y);
    bool isOver = abs(uv.x) > 1.0 || abs(uv.y) > 1.0;
    uv = uv * 0.5 + 0.5;

    float count = textureBlockSize;
    float totalCount = count * count;

    vec2 weight = (vWeight * resolution * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

    vec2 ratio = vec2(
        max((vResolution.x / vResolution.y) / (textureResolution.x / textureResolution.y), 1.0),
        max((vResolution.y / vResolution.x) / (textureResolution.y / textureResolution.x), 1.0)
    );

    // Triangle
//    float triangle = polygon(weight, 3.0, 0.0);
//    float n = 3.0;
//    triangle = fract(triangle * n - time);
//    float t = 1.0 - step(0.7, triangle);
//    t = mix(getTypePos(0.0), getTypePos(mod(time + rand(weight)*30.0, totalCount) + 1.0), t);

    // Ellipse
    float t = -length(weight * 2.0) + time;

    vec2 uvForTex = getUVForTexture(uv, t);

    vec3 bgColor = vBgColor;
    vec3 txtColor = vTextColor;
    vec4 tex = texture2D(texture, uvForTex);
    vec3 color = mix(bgColor, txtColor, tex.rgb);
    color = mix(bgColor, tex.rgb, step(0.1, t));

    if (isOver) {
        color = bgColor;
    }

    gl_FragColor = vec4(color, 1.0);
}`

let renderer, scene, geometry;
const index = [];
const vertices = [];
const uvs = [];
const offsets = [];
const indices = [];
const paddings = [];
const bgColors = [];
const textColors = [];
const size = [];
const directions = [];
const ratios = [];
const weights = [];

/**
 * From coolors
 * https://coolors.co/00ffc5
 */
const palettes = [
    {
        hexColor: "#020402",
        glColor: {},
        name: "Black"
    },
    {
        hexColor: "#c52233",
        glColor: {},
        name: "Cardinal"
    },
    {
        hexColor: "#5b2a86",
        glColor: {},
        name: "KSU Purple"
    },
    {
        hexColor: "#eeba0b",
        glColor: {},
        name: "Orange Yellow"
    },
    {
        hexColor: "#1098f7",
        glColor: {},
        name: "Dodger Blue"
    },
    {
        hexColor: "#00ffc5",
        glColor: {},
        name: "Sea Green Crayola"
    },
]
const texts = [
    "コード💻で切り拓く、アート🖼の新たな地平🌅。",
    "Gen Art 🖥 is the future🚀.",
    "@!+-?*/,[=}%:~&#_;*[>.$(¥",
    "🐻 KUMA 🌈 熊 🎌 くま 🧸 BEAR 🎨",
]

let baseTile;
let totalRenderCount = 0;
let lastUpdatedTime = 0;

// For dev
let currentTime = [0];

let uniforms;
let attr

/**
 * https://docs.artblocks.io/creator-docs/creator-onboarding/readme/
 */
class Random {
    constructor(hash) {
        this.useA = false;
        let sfc32 = function (uint128Hex) {
            let a = parseInt(uint128Hex.substr(0, 8), 16);
            let b = parseInt(uint128Hex.substr(8, 8), 16);
            let c = parseInt(uint128Hex.substr(16, 8), 16);
            let d = parseInt(uint128Hex.substr(24, 8), 16);
            return function () {
                a |= 0; b |= 0; c |= 0; d |= 0;
                let t = (((a + b) | 0) + d) | 0;
                d = (d + 1) | 0;
                a = b ^ (b >>> 9);
                b = (c + (c << 3)) | 0;
                c = (c << 21) | (c >>> 11);
                c = (c + t) | 0;
                return (t >>> 0) / 4294967296;
            };
        };
        // seed prngA with first half of tokenData.hash
        this.prngA = new sfc32(hash.substr(2, 32));
        // seed prngB with second half of tokenData.hash
        this.prngB = new sfc32(hash.substr(34, 32));
        for (let i = 0; i < 1e6; i += 2) {
            this.prngA();
            this.prngB();
        }
    }
    // random number between 0 (inclusive) and 1 (exclusive)
    random_dec() {
        this.useA = !this.useA;
        return this.useA ? this.prngA() : this.prngB();
    }
    // random number between a (inclusive) and b (exclusive)
    random_num(a, b) {
        return a + (b - a) * this.random_dec();
    }
    // random integer between a (inclusive) and b (inclusive)
    // requires a < b for proper probability distribution
    random_int(a, b) {
        return Math.floor(this.random_num(a, b + 1));
    }
    // random boolean with p as percent liklihood of true
    random_bool(p) {
        return this.random_dec() < p;
    }
    // random value in an array of items
    random_choice(list) {
        return list[this.random_int(0, list.length - 1)];
    }
}

/**
 * https://airtightinteractive.com/util/hex-to-glsl/
 *
 * @param hexStr
 * @returns {{r: number, b: number, g: number}|{r: *, b: *, g: *}}
 */
const hexToGL = (hexStr) => {
    if (/^#([0-9A-F]{3}){1,2}$/i.test(hexStr)) {
        let col = new THREE.Color(hexStr)
        let out = col.toArray().map((x) => {
            //to fixed 3
            let conv = Math.round(x * 1000) / 1000
            //append missing periods
            if (conv.toString().indexOf('.') === -1) {
                conv += '.0'
                conv = parseFloat(conv)
            }
            return conv
        })
        return {
            r: out[0],
            g: out[1],
            b: out[2]
        }
    } else {
        return {
            r: 0.0,
            g: 0.0,
            b: 0.0
        }
    }
}

const glToHex = (arr) => {
    arr = [arr.r, arr.g, arr.b]
    for (let val of arr) {
        if (val > 1 || val < 0) {
            return '';
        }
    }
    let col = new THREE.Color().fromArray(arr);
    return `#${col.getHexString()}`;
}

const getPalette = (colorId) => {
    const palette = palettes[colorId % palettes.length]
    palette.glColor = hexToGL(palette.hexColor)
    return palette
}

// TODO: Get hash from URL query string
const randomHash = () => {
    let result = '0x';
    for (let i = 0; i < 64; i++) {
        result += Math.floor(Math.random() * 16).toString(16);
    }
    return result;
}

const hash = randomHash()
const random = new Random(hash)

const renderTiles = () => {
    renderer = new THREE.WebGLRenderer();
    scene = new THREE.Scene();
    const bgColor = getTextColor(attr.bgColor.glColor)
    scene.background = new THREE.Color(bgColor);
    geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('index', new THREE.Uint16BufferAttribute(index, 1));
    geometry.setAttribute('totalIndex', new THREE.Float32BufferAttribute([...Array(index.length)].map(
        (_, index) => totalRenderCount
    ), 1));
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Uint16BufferAttribute(uvs, 2));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(size, 2));
    geometry.setAttribute('offset', new THREE.Float32BufferAttribute(offsets, 2));
    geometry.setAttribute('padding', new THREE.Float32BufferAttribute(paddings, 2));
    geometry.setAttribute('bgColor', new THREE.Float32BufferAttribute(bgColors, 3));
    geometry.setAttribute('textColor', new THREE.Float32BufferAttribute(textColors, 3));
    geometry.setAttribute('direction', new THREE.Float32BufferAttribute(directions, 1));
    geometry.setAttribute('ratio', new THREE.Float32BufferAttribute(ratios, 1));
    geometry.setAttribute('weight', new THREE.Float32BufferAttribute(weights, 2));

    const material = new THREE.RawShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        blending: THREE.NormalBlending,
        depthTest: true,
        wireframe: false,
        glslVersion: THREE.GLSL1
    });

    const mesh = new THREE.Mesh(geometry, material);

    scene.add(mesh);
};

const getTextColor = (glColor) => {
    return (glColor.r * 0.299 + glColor.g * 0.587 + glColor.b * 0.114) < (80 / 255) ? "#ffffff" : "#000000"
}

const createTextTexture = () => {
    const textNum = 5;
    const textSize = 200;

    let originalText = attr.text;
    let _originalText = Array.from(originalText).slice(0, textNum * textNum);

    while (_originalText.length < textNum * textNum) {
        _originalText.push("　");
    }

    const canvas = document.createElement("canvas");
    canvas.width = textNum * textSize;
    canvas.height = textNum * textSize;

    const ctx = canvas.getContext("2d");
    ctx.font = `${textSize * 0.8}px 'Arial'`;
    const bgColor = attr.bgColor
    ctx.fillStyle = bgColor.hexColor
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getTextColor(bgColor.glColor)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < _originalText.length; i++) {
        const x = i % textNum * textSize + textSize / 2;
        const y = Math.floor(i / textNum) * textSize + textSize / 2;
        ctx.fillText(_originalText[i], x, y);
    }

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    uniforms.texture.value = texture;
    uniforms.textureResolution.value = new THREE.Vector2(canvas.width, canvas.height);
    uniforms.textureBlockSize.value = textNum;
};

/**
 * こちらがattributesになります
 */
const getMetadataAttributes = () => {
    return {
        Text: attr.text,
        BackgroundColor: attr.bgColor.name,
        TileRatioOffset: attr.tileRatioOffset,
        Dynamic: attr.dynamic,
        Division: attr.division,
        Divider: attr.divider > 0,
    }
}

const createTiles = () => {
    attr = {
        text: random.random_choice(texts),
        textColor: hexToGL(`#ffffff`),
        bgColor: getPalette(random.random_int(0, palettes.length)),
        tileRatioOffset: random.random_num(0.0, 0.2),
        dynamic: random.random_bool(0.1),
        division: random.random_int(10, 12),
        divider: random.random_bool(0.1) ? 0.8 : 0.0,
    }
    console.log(getMetadataAttributes())
    uniforms = {
        time: { type: "f", value: 1.0 },
        resolution: { type: "v2", value: new THREE.Vector2() },
        texture: { type: 't', value: null },
        textureResolution: { type: "v2", value: new THREE.Vector2() },
        textureBlockSize: { type: "f", value: 1.0 },
        forceRadius: { value: 1 },
        pointerForce: { value: 1 },
        pointerForceFactor: { value: 0 },
        pointerPos: { value: new THREE.Vector2() },
    };
    baseTile = new Tile(-window.innerWidth / 2, -window.innerHeight / 2, window.innerWidth, window.innerHeight, 0);
    renderTiles();
    createTextTexture();
};

class Tile {
    constructor(x, y, w, h, age) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.age = age;
        this.children = [];
        this.offset = Math.floor(Math.random() * 50 + 1);
        this.ratio = 0.5 + (Math.random() * 2.0 - 1.0) * attr.tileRatioOffset;
        this.targetRatio = this.ratio;
        this.shouldRender = false;
        this.id = -1;
        this.impulse = 0;
        this.updateCount = 0;

        if (this.age < attr.division) {
            const nextAge = this.age + 1;
            if (this.age % 2 === 0) {
                // horizontal
                // ||
                const w1 = this.w * this.ratio;
                const w2 = this.w * (1 - this.ratio);
                this.children[0] = new Tile(
                    this.x,
                    this.y,
                    w1,
                    this.h, nextAge
                );
                this.children[1] = new Tile(
                    this.x + w1,
                    this.y,
                    w2,
                    this.h,
                    nextAge
                );
            } else {
                // vertical
                // ＝
                const h1 = this.h * this.ratio;
                const h2 = this.h * (1 - this.ratio);
                this.children[0] = new Tile(
                    this.x,
                    this.y,
                    this.w,
                    h1,
                    nextAge
                );
                this.children[1] = new Tile(
                    this.x,
                    this.y + h1,
                    this.w,
                    h2,
                    nextAge
                );
            }
        } else {
            // for render
            this.draw(false);
        }
    }
    updateTarget(ratio) {
        if (this.children.length > 0) {
            this.targetRatio = !!ratio ? ratio : Math.random();
            const _ratio = !!ratio ? ratio : null;
            this.children[0].updateTarget(_ratio);
            this.children[1].updateTarget(_ratio);
        }
    }
    update(arg = null) {
        if (!!arg) {
            this.x = arg.x;
            this.y = arg.y;
            this.w = arg.w;
            this.h = arg.h;
            this.impulse = arg.impulse;
        }
        if (this.children.length > 0) {
            let ratioDiff = Math.abs(this.ratio - this.targetRatio);
            if (ratioDiff < 0.002) {
                this.targetRatio = Math.random();
                this.updateCount++;
            }
            if (ratioDiff < 0.005) {
                ratioDiff = 0;
            }
            const duration = 0.5;
            const speed = 0.1;
            const r = Math.max(Math.min(Math.abs(this.targetRatio - this.ratio) / duration, speed), 0.0);
            this.ratio += (this.targetRatio - this.ratio) * r;
            this.ratio = Math.max(Math.min(this.ratio, 1), 0);

            if (this.age % 2 === 0) {
                // horizontal
                // ||
                const x1 = this.x;
                const y1 = this.y;
                const w1 = this.w * this.ratio;
                const h1 = this.h;
                this.children[0].update({
                    x: x1,
                    y: y1,
                    w: w1,
                    h: h1,
                    impulse: ratioDiff
                });

                const x2 = x1 + w1;
                const y2 = y1;
                const w2 = this.w * (1 - this.ratio);
                const h2 = this.h;
                this.children[1].update({
                    x: x2,
                    y: y2,
                    w: w2,
                    h: h2,
                    impulse: ratioDiff
                });
            } else {
                // vertical
                // ＝
                const x1 = this.x;
                const y1 = this.y;
                const w1 = this.w;
                const h1 = this.h * this.ratio;
                this.children[0].update({
                    x: x1,
                    y: y1,
                    w: w1,
                    h: h1,
                    impulse: ratioDiff
                });

                const x2 = this.x;
                const y2 = this.y + h1;
                const w2 = this.w;
                const h2 = this.h * (1 - this.ratio);
                this.children[1].update({
                    x: x2,
                    y: y2,
                    w: w2,
                    h: h2,
                    impulse: ratioDiff
                });
            }
        } else {
            // render
            this.draw(true);
        }
    }
    resize(arg) {
        this.x = arg.x;
        this.y = arg.y;
        this.w = arg.w;
        this.h = arg.h;

        if (this.children.length > 0) {
            if (this.age % 2 === 0) {
                // horizontal
                // ||
                const x1 = this.x;
                const y1 = this.y;
                const w1 = this.w * this.ratio;
                const h1 = this.h;
                this.children[0].resize({
                    x: x1,
                    y: y1,
                    w: w1,
                    h: h1
                });

                const x2 = x1 + w1;
                const y2 = y1;
                const w2 = this.w * (1 - this.ratio);
                const h2 = this.h;
                this.children[1].resize({
                    x: x2,
                    y: y2,
                    w: w2,
                    h: h2
                });
            } else {
                // vertical
                // ＝
                const x1 = this.x;
                const y1 = this.y;
                const w1 = this.w;
                const h1 = this.h * this.ratio;
                this.children[0].resize({
                    x: x1,
                    y: y1,
                    w: w1,
                    h: h1
                });

                const x2 = this.x;
                const y2 = this.y + h1;
                const w2 = this.w;
                const h2 = this.h * (1 - this.ratio);
                this.children[1].resize({
                    x: x2,
                    y: y2,
                    w: w2,
                    h: h2
                });
            }
        } else {
            // apply changes to renderer
            this.draw(true);
        }
    }
    draw(shouldUpdate = false) {
        this.shouldRender = true;

        if (shouldUpdate) {
            // Update
            const screenPos = this.getDistanceFromScreenCenter();

            for (let j = 0; j < 4; j++) {
                const targetIndex = this.id * 4 + j;

                const position = geometry.attributes.position;
                position.setXYZ(targetIndex, this.x, this.y, 0);
                position.needsUpdate = true;

                const size = geometry.attributes.size;
                size.setXY(targetIndex, this.w, this.h);
                size.needsUpdate = true;

                const ratio = geometry.attributes.ratio;
                ratio.setX(targetIndex, this.impulse);
                ratio.needsUpdate = true;

                const direction = geometry.attributes.direction;
                direction.setX(targetIndex, this.getDirection());
                direction.needsUpdate = true;

                const weight = geometry.attributes.weight;
                weight.setXY(targetIndex, screenPos.x, screenPos.y);
                weight.needsUpdate = true;
            }
        } else {
            // Initial
            this.id = totalRenderCount;
            const screenPos = this.getDistanceFromScreenCenter();

            for (let j = 0; j < 4; j++) {
                vertices.push(this.x, this.y, 0);
                size.push(this.w, this.h);
                directions.push(this.getDirection());
                ratios.push(this.ratio);
                weights.push(screenPos.x, screenPos.y);
            }

            const bgColor = attr.bgColor.glColor
            for (let j = 0; j < 4; j++) {
                index.push(this.id);
                paddings.push(attr.divider, attr.divider);
                bgColors.push(bgColor.r, bgColor.g, bgColor.b);
                textColors.push(attr.textColor.r, attr.textColor.g, attr.textColor.b);
            }

            uvs.push(
                0, 0,
                1, 0,
                1, 1,
                0, 1
            );
            offsets.push(
                0, 0,
                1, 0,
                1, 1,
                0, 1
            );

            const vertexIndex = this.id * 4;
            indices.push(
                vertexIndex + 0, vertexIndex + 1, vertexIndex + 2,
                vertexIndex + 2, vertexIndex + 3, vertexIndex + 0
            );

            totalRenderCount++;
        }
    }
    getDirection() {
        if (Math.abs(this.w - this.h) < 100.0) {
            return -1.0;
        } else if (this.w > this.h) {
            return 1.0;
        } else {
            return 0.0;
        }
    }
    getCenter() {
        return {
            x: this.x + this.w / 2,
            y: this.y + this.h / 2
        }
    }
    getDistanceFromScreenCenter() {
        const centerOfTile = this.getCenter();
        const w = window.innerWidth;
        const h = window.innerHeight;
        return {
            x: (centerOfTile.x + w / 2) / w,
            y: (centerOfTile.y + h / 2) / h
        };
    }
}

let pixelRatio = 1
let camera, pointerPos, clock
let isPointerActive = false

const FORCE_RADIUS = 800
const POINTER_FORCE = 400

// options
kumaleon.options = {
    onInit: () => {
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4)
        camera.position.z = 2
        camera.lookAt(0, 0, 0)
        camera.matrixAutoUpdate = false

        clock = new THREE.Clock()

        createTiles()

        const canvas = renderer.domElement
        document.querySelector('.js-main').appendChild(canvas)

        pointerPos = new THREE.Vector2()
        window.addEventListener('pointermove', (e) => {
            pointerPos.x = e.clientX
            pointerPos.y = e.clientY
            isPointerActive = true
        })

        // pass a canvas element.
        // If the canvas is not square, the center will be cropped.
        kumaleon.setCanvas(canvas)
    },

    onUpdate: () => {
        uniforms.pointerPos.value.x = pointerPos.x * pixelRatio
        uniforms.pointerPos.value.y = pointerPos.y * pixelRatio

        if (isPointerActive) {
            uniforms.pointerForceFactor.value += (1 - uniforms.pointerForceFactor.value) * 0.1
        }
        const time = clock.getElapsedTime()
        uniforms.time.value = time
        currentTime[0] = time;
        uniforms.forceRadius.value = FORCE_RADIUS * pixelRatio
        uniforms.pointerForce.value = POINTER_FORCE * pixelRatio

        if (baseTile && attr.dynamic) {
            baseTile.update();

            const sec = Math.floor(currentTime[0]);
            if (sec === 0 || sec !== lastUpdatedTime && sec % 10 === 0) {
                baseTile.updateTarget(0.5);
                lastUpdatedTime = sec;
            }
        }

        renderer.render(scene, camera)
    },

    onResize: () => {
        pixelRatio = Math.min(2, window.devicePixelRatio)

        // called when window resized
        const w = window.innerWidth
        const h = window.innerHeight
        const halfW = w * 0.5
        const halfH = h * 0.5

        camera.left = -halfW
        camera.right = halfW
        camera.top = halfH
        camera.bottom = -halfH
        camera.updateProjectionMatrix()

        uniforms.resolution.value.x = w * pixelRatio
        uniforms.resolution.value.y = h * pixelRatio

        renderer.setPixelRatio(pixelRatio)
        renderer.setSize(w, h)

        if (baseTile) {
            baseTile.resize({
                x: -window.innerWidth / 2,
                y: -window.innerHeight / 2,
                w: window.innerWidth,
                h: window.innerHeight
            })
        }
    },
}
