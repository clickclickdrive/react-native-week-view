import React from 'react';
import PropTypes from 'prop-types';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import _ from 'lodash';
import styles from './Times.styles';

const Times = ({
  times,
  width,
  textStyle,
  animatedGridStyle,
  hideMinuteSteps,
}) => {
  return (
    <View style={[styles.container, { width }]}>
      {_.map(times, (time) => {
        return (
          <Time
            key={time}
            time={time}
            width={width}
            textStyle={textStyle}
            hideMinuteSteps={hideMinuteSteps}
            animatedGridStyle={animatedGridStyle}
          />
        );
      })}
    </View>
  );
};

Times.propTypes = {
  times: PropTypes.arrayOf(PropTypes.string).isRequired,
  textStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  width: PropTypes.number.isRequired,
};

const Time = ({
  time,
  width,
  textStyle,
  animatedGridStyle,
  hideMinuteSteps,
}) => {
  const isHour = time.slice(-2) === '00';
  const MARGIN_LEFT = width / 4;

  const animatedText = useAnimatedStyle(() => {
    return {
      // eslint-disable-next-line no-nested-ternary
      color: isHour ? '#354354' : hideMinuteSteps ? 'transparent' : '#68727f',
      fontWeight: isHour ? '700' : '400',
      left: isHour ? MARGIN_LEFT : MARGIN_LEFT + 1.5,
      position: 'absolute',
    };
  });

  return (
    <Animated.View
      style={[styles.label, animatedGridStyle]}
      collapsable={false}
    >
      <Animated.Text style={[styles.text, textStyle, animatedText]}>
        {time}
      </Animated.Text>
    </Animated.View>
  );
};

export default React.memo(Times);
