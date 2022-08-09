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
}