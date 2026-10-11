# Karate +

A browser tribute to *International Karate +* (1987), built with Phaser 3, TypeScript and Vite. All art and sound are generated in code.

```
pnpm install
pnpm dev          # http://localhost:5173  (add ?poses for the pose/hitbox debug dojo)
pnpm test         # rules, input mapping and hit geometry
pnpm build
```

## Controls

Up/down on the title screen picks a mode: **Tournament** or **Scroller**. Arrows/WASD to move, Space/J for fire, M to mute. Gamepads work too. The layout follows the original IK+ manual, with directions relative to the way you face:

| Direction | Without fire | With fire |
|---|---|---|
| Up | Jump | Flying leap kick |
| Up + forward | Face punch | Head butt |
| Forward | Walk | Stomach kick |
| Down + forward | Shin kick | High face kick |
| Down | Foot sweep | Reverse sweep (turns you around) |
| Down + back | Crouching stomach punch | Back-step kick (turns you around) |
| Back | Walk back, or block when attacked from the front | Back flip |
| Up + back | Reverse punch (turns you around) | Double face kick |

Hold the joystick until a strike lands: letting go sooner cancels it. Picking a new move as an attack finishes chains straight into it. Blocking stops head, chest and stomach attacks, but not shin kicks or sweeps.

## Rules

Three fighters enter each round, and it goes on until only one is left standing. Each fighter has 3 lives. Any scoring strike knocks the other fighter down and costs them a life. They get back up after a moment, briefly protected while they flicker, and the fight carries on without stopping. A fighter who loses their last life stays down and is out.

A strike that lands with the tip of the limb at the right range is a full point, while a jammed or glancing strike is a half point. Points count towards your score. Be the last one standing to earn the next belt. The opponents get tougher every round: the first CPU out is replaced by a stronger challenger, and the one who survives moves up a belt. If you're the first one out, the game is over.

## Scroller

A side-scrolling beat-'em-up across four stages: the beach, the harbour, the temple and the mountain. Walk right until the screen locks, then beat the wave of karatekas that walks on from either side. Only two attack at once, while the rest wait their turn. Each stage ends with a boss. You have a health bar and 3 lives. Half points stagger and full points knock down, both for you and for them. Health left at the end of a stage is paid out as a bonus. Esc goes back to the title.
