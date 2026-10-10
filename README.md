# Karate +

A browser tribute to *International Karate +* (1987), built with Phaser 3, TypeScript and Vite. All art and sound are generated in code.

```
npm install
npm run dev      # http://localhost:5173  (add ?poses for the pose/hitbox debug dojo)
npm test         # rules, input mapping and hit geometry
npm run build
```

## Controls

Arrows/WASD to move, Space/J for fire, M to mute. Gamepads work too. Directions are relative to the way you face:

| Direction | Without fire | With fire |
|---|---|---|
| Up | Jump | High punch |
| Up + forward | Flying kick | High kick |
| Forward | Walk | Lunge punch |
| Down + forward | Front kick | Low kick |
| Down | Crouch | Splits kick |
| Down + back | Foot sweep | Back kick |
| Back | Walk back | Back roundhouse (turns you around) |
| Up + back | Back somersault | Head butt |
| — | — | Block (fire alone) |

## Rules

Three fighters enter each round, and it goes on until only one is left standing. Each fighter has 3 lives. Any scoring strike knocks the other fighter down and costs them a life. They get back up after a moment, briefly protected while they flicker, and the fight carries on without stopping. A fighter who loses their last life stays down and is out.

A strike that lands with the tip of the limb at the right range is a full point, while a jammed or glancing strike is a half point. Points count towards your score. Be the last one standing to earn the next belt. If you're the first one out, the game is over.
