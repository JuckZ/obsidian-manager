import type { Editor } from 'obsidian';
import { heartBeat } from './CursorEffects';

let shakeTime = 0,
    shakeTimeMax = 0,
    lastTime = 0,
    particlePointer = 0,
    effect,
    isActive = false,
    cmNode,
    canvas,
    ctx;

const shakeIntensity = 5,
    particles: any[] = [],
    MAX_PARTICLES = 500,
    PARTICLE_NUM_RANGE = { min: 5, max: 10 },
    PARTICLE_GRAVITY = 0.08,
    PARTICLE_ALPHA_FADEOUT = 0.96,
    PARTICLE_VELOCITY_RANGE = {
        x: [-1, 1],
        y: [-3.5, -1.5],
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // TODO document.getElementsByClassName('titlebar')[0].innerHeight
    titleBarHeight = 40,
    w = window.innerWidth,
    h = window.innerHeight - titleBarHeight;

const throttledShake = throttle(shake, 100);
const throttledSpawnParticles = throttle(spawnParticles, 100);

function getRGBComponents(node) {
    const color = getComputedStyle(node).color;
    if (color) {
        try {
            return color.match(/(\d+), (\d+), (\d+)/)?.slice(1);
        } catch (e) {
            return [255, 255, 255];
        }
    } else {
        return [255, 255, 255];
    }
}

function spawnParticles(cm, type) {
    const cursorPos = cm.getCursor();
    const pos = cm.coordsAtPos(cursorPos);
    const node = document.elementFromPoint(pos.left - 5, pos.top + 5);
    // heartBeat(node);
    type = cm.wordAt(cursorPos);
    if (type) {
        type = type.type;
    }
    const numParticles = random(PARTICLE_NUM_RANGE.min, PARTICLE_NUM_RANGE.max);
    const color = getRGBComponents(node);

    for (let i = numParticles; i--; ) {
        particles[particlePointer] = createParticle(pos.left + 10, pos.top - titleBarHeight, color);
        particlePointer = (particlePointer + 1) % MAX_PARTICLES;
    }
}

function createParticle(x, y, color) {
    const p = {
        x: x,
        y: y + 10,
        alpha: 1,
        color: color,
        size: 0,
        vx: 0,
        vy: 0,
        drag: 0,
        wander: 0,
        theta: 0,
    };
    if (effect === 1) {
        p.size = random(2, 4);
        p.vx =
            PARTICLE_VELOCITY_RANGE.x[0] +
            Math.random() * (PARTICLE_VELOCITY_RANGE.x[1] - PARTICLE_VELOCITY_RANGE.x[0]);
        p.vy =
            PARTICLE_VELOCITY_RANGE.y[0] +
            Math.random() * (PARTICLE_VELOCITY_RANGE.y[1] - PARTICLE_VELOCITY_RANGE.y[0]);
    } else if (effect === 2) {
        p.size = random(2, 8);
        p.drag = 0.92;
        p.vx = random(-3, 3);
        p.vy = random(-3, 3);
        p.wander = 0.15;
        p.theta = (random(0, 360) * Math.PI) / 180;
    }
    return p;
}

function effect1(particle) {
    particle.vy += PARTICLE_GRAVITY;
    particle.x += particle.vx;
    particle.y += particle.vy;

    particle.alpha *= PARTICLE_ALPHA_FADEOUT;

    ctx.fillStyle =
        'rgba(' + particle.color[0] + ',' + particle.color[1] + ',' + particle.color[2] + ',' + particle.alpha + ')';
    ctx.fillRect(Math.round(particle.x - 1), Math.round(particle.y - 1), particle.size, particle.size);
}

// Effect based on Soulwire's demo: http://codepen.io/soulwire/pen/foktm
function effect2(particle) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= particle.drag;
    particle.vy *= particle.drag;
    particle.theta += random(-0.5, 0.5);
    particle.vx += Math.sin(particle.theta) * 0.1;
    particle.vy += Math.cos(particle.theta) * 0.1;
    particle.size *= 0.96;

    ctx.fillStyle =
        'rgba(' + particle.color[0] + ',' + particle.color[1] + ',' + particle.color[2] + ',' + particle.alpha + ')';
    ctx.beginPath();
    ctx.arc(Math.round(particle.x - 1), Math.round(particle.y - 1), particle.size, 0, 2 * Math.PI);
    ctx.fill();
}

function drawParticles() {
    let particle;
    for (let i = particles.length; i--; ) {
        particle = particles[i];
        if (!particle || particle.alpha < 0.01 || particle.size <= 0.5) {
            continue;
        }

        if (effect === 1) {
            effect1(particle);
        } else if (effect === 2) {
            effect2(particle);
        }
    }
}

function shake(editor: Editor, time) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    cmNode = editor.containerEl;
    shakeTime = shakeTimeMax = time;
}

function random(min, max) {
    if (!max) {
        max = min;
        min = 0;
    }
    return min + ~~(Math.random() * (max - min + 1));
}

function throttle(callback, limit) {
    let wait = false;
    return function () {
        if (!wait) {
            // eslint-disable-next-line prefer-rest-params
            callback.apply(this, arguments);
            wait = true;
            setTimeout(function () {
                wait = false;
            }, limit);
        }
    };
}

function loop() {
    if (!isActive) {
        return;
    }

    ctx.clearRect(0, 0, w, h);

    // get the time past the previous frame
    const current_time = new Date().getTime();
    if (!lastTime) lastTime = current_time;
    const dt = (current_time - lastTime) / 1000;
    lastTime = current_time;
    if (shakeTime > 0) {
        shakeTime -= dt;
        const magnitude = (shakeTime / shakeTimeMax) * shakeIntensity;
        const shakeX = random(-magnitude, magnitude);
        const shakeY = random(-magnitude, magnitude);
        cmNode.style.transform = 'translate(' + shakeX + 'px,' + shakeY + 'px)';
    }
    drawParticles();
    requestAnimationFrame(loop);
}

export function onCodeMirrorChange(editor) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    throttledShake(editor, 0.3);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    throttledSpawnParticles(editor);
}

export function initBlast() {
    effect = 2;
    isActive = true;

    if (!canvas) {
        canvas = document.createElement('canvas');
        (ctx = canvas.getContext('2d')), (canvas.id = 'code-blast-canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = `${titleBarHeight}px`;
        canvas.style.left = 0;
        canvas.style.zIndex = 1;
        canvas.style.pointerEvents = 'none';
        canvas.width = w;
        canvas.height = h;

        document.body.appendChild(canvas);
        loop();
    }
}

export function destroyBlast() {
    isActive = false;
    if (canvas) {
        canvas.remove();
        canvas = null;
    }
}
