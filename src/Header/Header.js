import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity } from 'react-native';
import moment from 'moment';
import _ from 'lodash';
import {
  getFormattedDate,
  calculateDaysArray,
  availableNumberOfDays,
} from '../utils/dates';
import styles from './Header.styles';

const DefaultDayComponent = ({ textStyle, formattedDate }) => (
  <Text style={[styles.text, textStyle]}>{formattedDate}</Text>
);

const Column = ({
  column,
  format,
  style,
  textStyle,
  DayComponent,
  TodayComponent,
  onDayPress,
  width,
  CustomHeaderComponent,
}) => {
  const formattedDate = getFormattedDate(column, format);
  const isToday = moment().isSame(column, 'days');

  const ComponentChosen =
    CustomHeaderComponent ||
    DayComponent ||
    (isToday && TodayComponent) ||
    DefaultDayComponent;

  return (
    <TouchableOpacity
      style={[styles.column, style, { width }]}
      onPress={() => onDayPress && onDayPress(column, formattedDate)}
      disabled={!onDayPress}
    >
      <ComponentChosen
        date={column}
        formattedDate={formattedDate}
        textStyle={textStyle}
        isToday={isToday}
      />
    </TouchableOpacity>
  );
};

const WeekViewHeader = ({
  numberOfDays,
  initialDate,
  formatDate,
  style,
  textStyle,
  TodayComponent,
  DayComponent,
  rightToLeft,
  onDayPress,
  dayWidth,
  // new Props,
  CustomHeaderComponent,
  columnHeaderStyle,
}) => {
  const columns =
    calculateDaysArray(initialDate, numberOfDays, rightToLeft) || [];
  return (
    <View style={[styles.container, columnHeaderStyle]}>
      {_.map(columns, (column) => (
        <Column
          style={style}
          textStyle={textStyle}
          key={column}
          column={column}
          format={formatDate}
          DayComponent={DayComponent}
          TodayComponent={TodayComponent}
          onDayPress={onDayPress}
          width={dayWidth}
          CustomHeaderComponent={CustomHeaderComponent}
        />
      ))}
    </View>
  );
};

WeekViewHeader.propTypes = {
  numberOfDays: PropTypes.oneOf(availableNumberOfDays).isRequired,
  initialDate: PropTypes.string.isRequired,
  formatDate: PropTypes.string,
  style: PropTypes.object,
  textStyle: PropTypes.object,
  rightToLeft: PropTypes.bool,
  DayComponent: PropTypes.elementType,
  TodayComponent: PropTypes.elementType,
  onDayPress: PropTypes.func,
  dayWidth: PropTypes.number.isRequired,
  // new Props
  CustomHeaderComponent: PropTypes.elementType,
  columnHeaderStyle: PropTypes.object,
};

WeekViewHeader.defaultProps = {
  formatDate: 'MMM D',
};

export default React.memo(WeekViewHeader);
