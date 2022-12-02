import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import styles from './Times.styles';

const Times = ({
  times,
  textStyle,
  width,
  timeLabelHeight,
  animatedGridStyle,
  onChangeGridHeight,
}) => {
  useEffect(() => {
    onChangeGridHeight && onChangeGridHeight(timeLabelHeight);
  }, [timeLabelHeight]);

  return (
    <View style={[styles.container, { width }]}>
      {times.map((time) => {
        return (
          <Animated.View
            key={time}
            style={[
              styles.label,
              { height: timeLabelHeight },
              animatedGridStyle,
            ]}
            collapsable={false}
          >
            <Time time={time} textStyle={textStyle} />
          </Animated.View>
        );
      })}
    </View>
  );
};

Times.propTypes = {
  times: PropTypes.arrayOf(PropTypes.string).isRequired,
  textStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  width: PropTypes.number.isRequired,
  timeLabelHeight: PropTypes.number.isRequired,
};

export default React.memo(Times);

const Time = ({ time, textStyle }) => {
  const animatedText = useAnimatedStyle(() => {
    return {
      color: time.slice(-2) !== '00' ? '#68727f' : '#354354',
      fontWeight: time.slice(-2) !== '00' ? '400' : '700',
    };
  });

  return (
    <>
      <Animated.Text style={[styles.text, textStyle, animatedText]}>
        {time}
      </Animated.Text>
    </>
  );
};
