import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { View, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import styles, { circleStyles } from './Event.styles';
import { EventPropType, EditEventConfigPropType } from '../utils/types';

const UPDATE_EVENT_ANIMATION_DURATION = 150;
const SIDES = ['bottom', 'top', 'left', 'right'];

const useCurrentDimension = (dimension) => {
  const currentDimension = useSharedValue(dimension);
  useAnimatedReaction(
    () => dimension,
    (newValue) => {
      if (currentDimension.value !== newValue) {
        currentDimension.value = withTiming(newValue, {
          duration: UPDATE_EVENT_ANIMATION_DURATION,
        });
      }
    },
  );
  return currentDimension;
};

const Circle = ({ side }) => (
  <View
    style={circleStyles[side]}
    hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
  />
);

const Circles = ({ isEditing, editEventConfig, buildCircleGesture }) =>
  isEditing
    ? SIDES.reduce((acc, side) => {
        if (editEventConfig[side]) {
          acc.push(
            <GestureDetector key={side} gesture={buildCircleGesture(side)}>
              <Circle side={side} />
            </GestureDetector>,
          );
        }
        return acc;
      }, [])
    : [];

const Event = ({
  event,
  top,
  left,
  height,
  width,
  onPress,
  onLongPress,
  EventComponent,
  containerStyle,
  onDrag,
  onEdit,
  editingEventId,
  editEventConfig,
  zoomingScale,
  beginAgendaAt,
  verticalResolution,
  mins,
}) => {
  const isEditing = !!onEdit && editingEventId === event.id;
  const isDragEnabled =
    !!onDrag && editingEventId == null && !event.disableDrag;

  // Wrappers are needed due to RN-reanimated runOnJS behavior. See docs:
  // https://docs.swmansion.com/react-native-reanimated/docs/api/miscellaneous/runOnJS
  const onPressWrapper = useCallback(() => onPress && onPress(event), [
    event,
    onPress,
  ]);
  const onLongPressWrapper = useCallback(
    () => onLongPress && onLongPress(event),
    [event, onLongPress],
  );

  const onDragRelease = useCallback(
    (dx, dy) => {
      if (!onDrag) {
        return;
      }

      const newX = left + width / 2 + dx;
      const newY = top + dy;
      onDrag(event, newX, newY);
    },
    [event, left, top, width, onDrag],
  );

  const onEditRelease = useCallback(
    (params) => onEdit && onEdit(event, params),
    [event, onEdit],
  );

  const resizeByEdit = {
    bottom: useSharedValue(0),
    right: useSharedValue(0),
    top: useSharedValue(0),
    left: useSharedValue(0),
  };

  const translatedByDrag = useSharedValue({ x: 0, y: 0 });
  const currentWidth = useCurrentDimension(width);
  const currentLeft = useCurrentDimension(left);
  const currentTop = useCurrentDimension(top);
  const currentHeight = useCurrentDimension(height);

  const isDragging = useSharedValue(false);
  const isPressing = useSharedValue(false);
  const isLongPressing = useSharedValue(false);

  const currentOpacity = useDerivedValue(() => {
    if (isDragging.value || isPressing.value || isLongPressing.value) {
      return 0.5;
    }
    return 1;
  });

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translatedByDrag.value.x },
        { translateY: translatedByDrag.value.y },
      ],
      width:
        currentWidth.value + resizeByEdit.right.value - resizeByEdit.left.value,
      left: currentLeft.value + resizeByEdit.left.value,
      top: zoomingScale
        ? (mins - (beginAgendaAt || 0)) *
            (verticalResolution * zoomingScale.value) +
          16
        : currentTop.value + resizeByEdit.top.value,
      height: zoomingScale
        ? (currentHeight.value +
            resizeByEdit.bottom.value -
            resizeByEdit.top.value) *
          zoomingScale.value
        : currentHeight.value +
          resizeByEdit.bottom.value -
          resizeByEdit.top.value,
      opacity: withSpring(currentOpacity.value),
    };
  });

  const dragGesture = Gesture.Pan()
    .enabled(isDragEnabled)
    .withTestId(`dragGesture-${event.id}`)
    .onTouchesDown(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translatedByDrag.value = {
        x: e.translationX,
        y: e.translationY,
      };
    })
    .onEnd((evt, success) => {
      if (!success) {
        translatedByDrag.value = { x: 0, y: 0 };
        return;
      }
      const { translationX, translationY } = evt;

      currentTop.value += translationY;
      currentLeft.value += translationX;
      translatedByDrag.value = { x: 0, y: 0 };

      runOnJS(onDragRelease)(translationX, translationY);
    })
    .onFinalize(() => {
      isDragging.value = false;
    });

  const longPressGesture = Gesture.LongPress()
    .enabled(!!onLongPress && !event.disableLongPress)
    .maxDistance(20)
    .onTouchesDown(() => {
      isLongPressing.value = true;
    })
    .onEnd((evt, success) => {
      if (success) {
        runOnJS(onLongPressWrapper)();
      }
    })
    .onFinalize(() => {
      isLongPressing.value = false;
    });

  const pressGesture = Gesture.Tap()
    .enabled(!!onPress && !event.disablePress)
    .withTestId(`pressGesture-${event.id}`)
    .onTouchesDown(() => {
      isPressing.value = true;
    })
    .onEnd((evt, success) => {
      if (success) {
        runOnJS(onPressWrapper)();
      }
    })
    .onFinalize(() => {
      isPressing.value = false;
    });

  const composedGesture = Gesture.Race(
    dragGesture,
    longPressGesture,
    pressGesture,
  );
  const PressComposedGesture = Gesture.Race(pressGesture);

  const buildCircleGesture = (side) =>
    Gesture.Pan()
      .onUpdate((panEvt) => {
        const { translationX, translationY } = panEvt;
        switch (side) {
          case 'top':
            if (translationY < height) {
              resizeByEdit.top.value = translationY;
            }
            break;
          case 'bottom':
            if (translationY > -height) {
              resizeByEdit.bottom.value = translationY;
            }
            break;
          case 'left':
            if (translationX < width) {
              resizeByEdit.left.value = translationX;
            }
            break;
          case 'right':
            if (translationX > -width) {
              resizeByEdit.right.value = translationX;
            }
            break;
          default:
        }
      })
      .onEnd((panEvt, success) => {
        if (!success) {
          resizeByEdit[side].value = 0;
          return;
        }
        const resizedAmount = resizeByEdit[side].value;
        resizeByEdit[side].value = 0;

        const params = {};
        switch (side) {
          case 'top':
            currentTop.value += resizedAmount;
            currentHeight.value -= resizedAmount;
            params.top = currentTop.value;
            break;
          case 'bottom':
            currentHeight.value += resizedAmount;
            params.bottom = currentTop.value + currentHeight.value;
            break;
          case 'left':
            currentLeft.value += resizedAmount;
            currentWidth.value -= resizedAmount;
            params.left = currentLeft.value;
            break;
          case 'right':
            currentWidth.value += resizedAmount;
            params.right = currentLeft.value + currentWidth.value;
            break;
          default:
        }

        runOnJS(onEditRelease)(params);
      });

  const EventContainer = ({ children }) => {
    if (isDragEnabled)
      return (
        <GestureDetector gesture={composedGesture}>{children}</GestureDetector>
      );
    return (
      <GestureDetector gesture={PressComposedGesture}>
        {children}
      </GestureDetector>
    );
  };

  return (
    <EventContainer>
      <Animated.View
        testID={`WeekViewEvent-${event.id}`}
        accessible
        accessibilityLabel={`Show event ${event.id}`}
        accessibilityHint={`Show event ${event.id}`}
        style={[
          styles.container,
          {
            backgroundColor: event.color,
          },
          containerStyle,
          event.style,
          animatedStyles,
        ]}
      >
        {EventComponent ? (
          <EventComponent
            event={event}
            position={{ top, left, height, width }}
          />
        ) : (
          <Text style={[styles.description, event.eventTextStyle]}>
            {event.description}
          </Text>
        )}
        <Circles
          isEditing={isEditing}
          editEventConfig={editEventConfig}
          buildCircleGesture={buildCircleGesture}
        />
      </Animated.View>
    </EventContainer>
  );
};

Event.propTypes = {
  event: EventPropType.isRequired,
  top: PropTypes.number.isRequired,
  left: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  onPress: PropTypes.func,
  onLongPress: PropTypes.func,
  containerStyle: PropTypes.object,
  EventComponent: PropTypes.elementType,
  onDrag: PropTypes.func,
  onEdit: PropTypes.func,
  editingEventId: PropTypes.number,
  editEventConfig: EditEventConfigPropType,
};

export default React.memo(Event);
