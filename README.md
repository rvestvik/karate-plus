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

Three fighters, 30 second rounds, first to 6 points ends the round early. A strike that lands with the tip of the limb at the right range is a full point, while a jammed or glancing strike is a half point. Last place is eliminated. Win a round outright to earn the next belt.
