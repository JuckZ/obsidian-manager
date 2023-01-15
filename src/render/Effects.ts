import party from 'party-js';
import {
    // Bloop bloop bloop, you're under the se
    bubbleCursor,
    // An oldie, a little ugly, but true history
    clockCursor,
    // A nice modern dusting of emoji based particles
    emojiCursor,
    // An old classic, sprinkling stardust onto the page
    fairyDustCursor,
    // A dot that follows your mouse with a little lag, a modern look
    followingDotCursor,
    // A trailing of ghost cursors, as classic as they come
    ghostCursor,
    // A little color never hurt anyone
    rainbowCursor,
    // Winter is here, and it's brought snow with it
    snowflakeCursor,
    // Guaranteed to provide fun for hours
    springyEmojiCursor,
    // A waving banner of text
    textFlag,
    // An elasticish trail of cursors that will nip to wherever your mouse is
    trailingCursor,
} from 'cursor-effects';

export function showEmojiCursor() {
    const emo = new emojiCursor({ emoji: ['要事第一'] });
    const timer = window.setTimeout(() => {
        emo.destroy();
        clearTimeout(timer);
    }, 1000);
    // new emojiCursor({ emoji: ['🔥', '🐬', '🦆'] });
}

export default function heartBeat() {
    // party.confetti(node, {
    //     shapes: ['roundedSquare', '富强'],
    //     count: party.variation.range(4, 5),
    // });

    // party.resolvableShapes['富强'] = '<div>hello</div>';

    const heartPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    heartPath.setAttribute(
        'd',
        'M316.722,29.761c66.852,0,121.053,54.202,121.053,121.041c0,110.478-218.893,257.212-218.893,257.212S0,266.569,0,150.801 C0,67.584,54.202,29.761,121.041,29.761c40.262,0,75.827,19.745,97.841,49.976C240.899,49.506,276.47,29.761,316.722,29.761z',
    );

    const heartShape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    heartShape.setAttribute('viewBox', '0 0 512 512');
    heartShape.setAttribute('height', '20');
    heartShape.setAttribute('width', '20');
    heartShape.appendChild(heartPath);

    party.scene.current.createEmitter({
        emitterOptions: {
            loops: 1,
            useGravity: false,
            modules: [
                new party.ModuleBuilder()
                    .drive('size')
                    .by(t => 0.5 + 0.3 * (Math.cos(t * 10) + 1))
                    .build(),
                new party.ModuleBuilder()
                    .drive('rotation')
                    .by(t => new party.Vector(0, 0, 100).scale(t))
                    .relative()
                    .build(),
            ],
        },
        emissionOptions: {
            rate: 0,
            bursts: [{ time: 0, count: party.variation.skew(20, 10) }],
            sourceSampler: party.sources.dynamicSource(node),
            angle: party.variation.range(0, 360),
            initialSpeed: 400,
            initialColor: party.variation.gradientSample(
                party.Gradient.simple(party.Color.fromHex('#ffa68d'), party.Color.fromHex('#fd3a84')),
            ),
        },
        rendererOptions: {
            shapeFactory: heartShape,
            applyLighting: undefined,
        },
    });
}
