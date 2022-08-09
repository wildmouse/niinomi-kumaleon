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
}