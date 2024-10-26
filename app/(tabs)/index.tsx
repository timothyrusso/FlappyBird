import {
  Canvas,
  useImage,
  Image,
  Group,
  Text,
  matchFont,
  FontWeight,
  LinearGradient,
} from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import {
  Easing,
  useSharedValue,
  withTiming,
  withSequence,
  withRepeat,
  useFrameCallback,
  useDerivedValue,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';

const GRAVITY = 1000;
const JUMP_FORCE = -500;
const pipeWidth = 104;
const pipeHeight = 640;

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const [score, setScore] = useState(0);

  const isPointCollodingWithRectangle = (point, rectangle) => {
    'worklet';
    return (
      point.x >= rectangle.x &&
      point.x <= rectangle.x + rectangle.width &&
      point.y >= rectangle.y &&
      point.y <= rectangle.y + rectangle.height
    );
  };

  const bg = useImage(require('../../assets/sprites/background-night.png'));
  const bird = useImage(require('../../assets/sprites/redbird-upflap.png'));
  const pipeBottom = useImage(require('../../assets/sprites/pipe-red.png'));
  const pipeTop = useImage(
    require('../../assets/sprites/pipe-red-rotated.png')
  );
  const base = useImage(require('../../assets/sprites/base.png'));

  const gameOver = useSharedValue(false);
  const PipeX = useSharedValue(width - 50);

  const birdY = useSharedValue(height / 3);
  const birdX = width / 4;

  const birdYVelocity = useSharedValue(0);
  const pipeOffset = useSharedValue(0);
  const topPipeY = useDerivedValue(() => pipeOffset.value - 320);
  const bottomPipeY = useDerivedValue(() => height - 320 + pipeOffset.value);

  const pipeSpeed = useDerivedValue(() => {
    return interpolate(score, [0, 20], [1, 2]);
  });

  const obstacles = useDerivedValue(() => [
    // add bottom pipe
    {
      x: PipeX.value,
      y: height - 320 + pipeOffset.value,
      width: pipeWidth,
      height: pipeHeight,
    },
    // add top pipe
    {
      x: PipeX.value,
      y: pipeOffset.value - 320,
      width: pipeWidth,
      height: pipeHeight,
    },
  ]);

  useEffect(() => {
    moveTheMap();
  }, []);

  const moveTheMap = () => {
    PipeX.value = withSequence(
      withTiming(width, { duration: 0 }),
      withTiming(-150, {
        duration: 3000 / pipeSpeed.value,
        easing: Easing.linear,
      }),
      withTiming(width, { duration: 0 })
    );
  };

  // Scoring system
  useAnimatedReaction(
    () => PipeX.value,
    (currentValue, previousValue) => {
      const scorePosition = birdX;

      if (previousValue && currentValue < -100 && previousValue > -100) {
        pipeOffset.value = Math.random() * 400 - 200;
        cancelAnimation(PipeX);
        runOnJS(moveTheMap)();
      }

      if (
        currentValue !== previousValue &&
        currentValue <= scorePosition &&
        previousValue &&
        previousValue > scorePosition
      ) {
        runOnJS(setScore)(score + 1);
      }
    }
  );

  // Collision detection
  useAnimatedReaction(
    () => birdY.value,
    (currentValue, previousValue) => {
      const center = {
        x: birdX + 32,
        y: birdY.value + 24,
      };

      // Ground collision
      if (currentValue > height - 130 || currentValue < 0) {
        gameOver.value = true;
      }

      const isColliding = obstacles.value.some((rectangle) =>
        isPointCollodingWithRectangle(center, rectangle)
      );

      if (isColliding) {
        gameOver.value = true;
      }
    }
  );

  useAnimatedReaction(
    () => gameOver.value,
    (currentValue, previousValue) => {
      if (currentValue && !previousValue) {
        cancelAnimation(PipeX);
      }
    }
  );

  useFrameCallback(({ timeSincePreviousFrame: dt }) => {
    if (!dt || gameOver.value) return;
    birdY.value = birdY.value + (birdYVelocity.value * dt) / 1000;
    birdYVelocity.value = birdYVelocity.value + (GRAVITY * dt) / 1000;
  });

  const restartGame = () => {
    'worklet';
    birdY.value = height / 3;
    birdYVelocity.value = 0;
    gameOver.value = false;
    PipeX.value = width;
    runOnJS(moveTheMap)();
    runOnJS(setScore)(0);
  };

  const gesture = Gesture.Tap().onStart(() => {
    if (gameOver.value) {
      restartGame();
    } else {
      birdYVelocity.value = JUMP_FORCE;
    }
  });

  const birdTransform = useDerivedValue(() => {
    return [
      {
        rotate: interpolate(
          birdYVelocity.value,
          [-500, 500],
          [-0.5, 0.5],
          Extrapolation.CLAMP
        ),
      },
    ];
  });
  const birdOrigin = useDerivedValue(() => {
    return { x: width / 4 + 32, y: birdY.value + 24 };
  });

  const fontFamily = Platform.select({
    ios: 'Arial',
    android: 'sans-serif',
    default: 'Arial',
  });
  const fontStyle = {
    fontFamily,
    fontSize: 40,
    fontWeight: FontWeight.Bold,
  };
  const font = matchFont(fontStyle);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height }}>
          <Image image={bg} fit={'cover'} width={width} height={height} />

          <Image
            image={pipeTop}
            y={topPipeY}
            x={PipeX}
            width={pipeWidth}
            height={pipeHeight}
          />
          <Image
            image={pipeBottom}
            y={bottomPipeY}
            x={PipeX}
            width={pipeWidth}
            height={pipeHeight}
          />

          <Image
            image={base}
            width={width}
            height={150}
            y={height - 75}
            x={0}
            fit={'cover'}
          />

          <Group transform={birdTransform} origin={birdOrigin}>
            <Image image={bird} y={birdY} x={birdX} width={64} height={48} />
          </Group>

          {/* <Text
            x={width / 4}
            y={100}
            text={`SCORE: ${score.toString()}`}
            font={font}
            color="white"
          /> */}
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
