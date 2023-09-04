import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import moment from 'moment';
import memoizeOne from 'memoize-one';

import _ from 'lodash';
import NowLine from '../NowLine/NowLine';
import Event from '../Event/Event';
import {
  EventWithMetaPropType,
  GridRowPropType,
  GridColumnPropType,
} from '../utils/types';
import {
  calculateDaysArray,
  DATE_STR_FORMAT,
  availableNumberOfDays,
  minutesInDay,
} from '../utils/dates';
import { topToSecondsInDay as topToSecondsInDayFromUtils } from '../utils/dimensions';
import { ViewWithTouchable } from '../utils/gestures';

import styles from './Events.styles';
import resolveEventOverlaps from '../pipeline/overlap';
import {
  computeHeight,
  computeWidth,
  computeLeft,
  computeTop,
} from '../pipeline/position';

const processEvents = (
  eventsByDate,
  initialDate,
  numberOfDays,
  rightToLeft,
) => {
  // totalEvents stores events in each day of numberOfDays
  // example: [[event1, event2], [event3, event4], [event5]], each child array
  // is events for specific day in range
  const dates = calculateDaysArray(initialDate, numberOfDays, rightToLeft);
  return _.map(dates, (date) => {
    const dateStr = date.format(DATE_STR_FORMAT);
    return resolveEventOverlaps(eventsByDate[dateStr] || []);
  });
};

const Lines = ({
  initialDate,
  times,
  gridRowStyle,
  animatedGridStyle,
  highlightLineStyle,
  hideMinuteSteps,
}) => {
  return _.map(times, (time) => (
    <Animated.View
      collapsable={false}
      key={`${initialDate}-${time}`}
      style={[
        styles.timeRow,
        gridRowStyle,
        animatedGridStyle,
        time.slice(-2) === '00' && highlightLineStyle,
        time.slice(-2) !== '00' && hideMinuteSteps && styles.transparentLine,
      ]}
    />
  ));
};

class Events extends PureComponent {
  topToSecondsInDay = (yValue) =>
    topToSecondsInDayFromUtils(
      yValue,
      this.props.verticalResolution * this.props?.zoomingScale?.value || 1,
      this.props.beginAgendaAt,
    );

  xToDayIndex = (xValue) => Math.floor(xValue / this.props.dayWidth);

  processEvents = memoizeOne(processEvents);

  /* Wrap callbacks to avoid shallow changes */
  handlePressEvent = (...args) =>
    this.props.onEventPress && this.props.onEventPress(...args);

  handleLongPressEvent = (...args) =>
    this.props.onEventLongPress && this.props.onEventLongPress(...args);

  handleGridTouch = (pressEvt, callback) => {
    if (!callback) {
      return;
    }
    const dayIndex = this.xToDayIndex(pressEvt.x);
    const secondsInDay = this.topToSecondsInDay(pressEvt.y);

    const dateWithTime = moment(this.props.initialDate)
      .add(dayIndex, 'day')
      .startOf('day')
      .seconds(secondsInDay)
      .toDate();

    callback(pressEvt, dateWithTime.getHours(), dateWithTime);
  };

  handleGridPress = (pressEvt) => {
    this.handleGridTouch(pressEvt, this.props.onGridClick);
  };

  handleGridLongPress = (pressEvt) => {
    this.handleGridTouch(pressEvt, this.props.onGridLongPress);
  };

  handleDragEvent = (event, newX, newY) => {
    const { onDragEvent } = this.props;
    if (!onDragEvent) {
      return;
    }

    // NOTE: The point (newX, newY) is in the eventsColumn coordinates
    const movedDays = this.xToDayIndex(newX);
    const secondsInDay = this.topToSecondsInDay(newY);

    const newStartDate = moment(event.startDate)
      .add(movedDays, 'days')
      .startOf('day')
      .seconds(secondsInDay)
      .toDate();

    const eventDuration = event.endDate.getTime() - event.startDate.getTime();
    const newEndDate = new Date(newStartDate.getTime() + eventDuration);

    onDragEvent(event, newStartDate, newEndDate);
  };

  handleEditEvent = (event, params) => {
    const { onEditEvent } = this.props;
    if (!onEditEvent) {
      return;
    }
    if (!params || Object.keys(params).length === 0) {
      return;
    }

    let newStartDate = moment(event.startDate);
    let newEndDate = moment(event.endDate);

    if (params.left != null) {
      const daysToLeft = this.xToDayIndex(params.left);
      newStartDate = newStartDate.add(daysToLeft, 'days');
    }
    if (params.right != null) {
      const movedRight = this.xToDayIndex(params.right);
      newEndDate = newEndDate.add(movedRight, 'days');
    }
    if (params.top != null) {
      newStartDate = newStartDate
        .startOf('day')
        .seconds(this.topToSecondsInDay(params.top));
    }
    if (params.bottom != null) {
      newEndDate = newEndDate
        .startOf('day')
        .seconds(this.topToSecondsInDay(params.bottom));
    }

    onEditEvent(event, newStartDate.toDate(), newEndDate.toDate());
  };

  isToday = (dayIndex) => {
    const { initialDate } = this.props;
    const today = moment();
    return moment(initialDate).add(dayIndex, 'days').isSame(today, 'day');
  };

  render() {
    const {
      eventsByDate,
      initialDate,
      numberOfDays,
      times,
      onEventPress,
      onEventLongPress,
      eventContainerStyle,
      gridRowStyle,
      gridColumnStyle,
      EventComponent,
      rightToLeft,
      beginAgendaAt,
      showNowLine,
      nowLineColor,
      onDragEvent,
      onGridClick,
      onGridLongPress,
      dayWidth,
      pageWidth,
      timeLabelHeight,
      verticalResolution,
      onEditEvent,
      editingEventId,
      editEventConfig,
      zoomingScale,
      animatedGridStyle,
      highlightLineStyle,
      hideMinuteSteps,
    } = this.props;
    const totalEvents = this.processEvents(
      eventsByDate,
      initialDate,
      numberOfDays,
      rightToLeft,
    );

    return (
      <View style={[styles.container, { width: pageWidth }]}>
        <Lines
          initialDate={initialDate}
          times={times}
          timeLabelHeight={timeLabelHeight}
          gridRowStyle={gridRowStyle}
          hideMinuteSteps={hideMinuteSteps}
          animatedGridStyle={animatedGridStyle}
          highlightLineStyle={highlightLineStyle}
        />
        <ViewWithTouchable
          style={styles.eventsContainer}
          onPress={onGridClick && this.handleGridPress}
          onLongPress={onGridLongPress && this.handleGridLongPress}
        >
          {_.map(totalEvents, (eventsInSection, dayIndex) => (
            <View
              style={[styles.eventsColumn, gridColumnStyle]}
              key={`${initialDate}-${dayIndex}`}
            >
              {showNowLine && this.isToday(dayIndex) && (
                <NowLine
                  color={nowLineColor}
                  verticalResolution={verticalResolution}
                  width={dayWidth}
                  beginAgendaAt={beginAgendaAt}
                  zoomingScale={zoomingScale}
                />
              )}
              {_.map(eventsInSection, (item) => {
                const { ref: event, box, overlap = {} } = item;
                return (
                  <Event
                    key={event.id}
                    event={event}
                    top={computeTop(box, verticalResolution, beginAgendaAt)}
                    height={computeHeight(box, verticalResolution)}
                    left={computeLeft(overlap, dayWidth)}
                    width={computeWidth(overlap, dayWidth)}
                    onPress={onEventPress && this.handlePressEvent}
                    onLongPress={onEventLongPress && this.handleLongPressEvent}
                    EventComponent={EventComponent}
                    containerStyle={eventContainerStyle}
                    onDrag={onDragEvent && this.handleDragEvent}
                    onEdit={onEditEvent && this.handleEditEvent}
                    editingEventId={editingEventId}
                    editEventConfig={editEventConfig}
                    beginAgendaAt={beginAgendaAt}
                    verticalResolution={verticalResolution}
                    mins={minutesInDay(box.startDate)}
                    zoomingScale={zoomingScale}
                  />
                );
              })}
            </View>
          ))}
        </ViewWithTouchable>
      </View>
    );
  }
}

Events.propTypes = {
  numberOfDays: PropTypes.oneOf(availableNumberOfDays).isRequired,
  eventsByDate: PropTypes.objectOf(PropTypes.arrayOf(EventWithMetaPropType))
    .isRequired,
  initialDate: PropTypes.string.isRequired,
  times: PropTypes.arrayOf(PropTypes.string).isRequired,
  onEventPress: PropTypes.func,
  onEventLongPress: PropTypes.func,
  onGridClick: PropTypes.func,
  onGridLongPress: PropTypes.func,
  eventContainerStyle: PropTypes.object,
  gridRowStyle: GridRowPropType,
  gridColumnStyle: GridColumnPropType,
  EventComponent: PropTypes.elementType,
  rightToLeft: PropTypes.bool,
  showNowLine: PropTypes.bool,
  nowLineColor: PropTypes.string,
  beginAgendaAt: PropTypes.number,
  onDragEvent: PropTypes.func,
  pageWidth: PropTypes.number.isRequired,
  dayWidth: PropTypes.number.isRequired,
  verticalResolution: PropTypes.number.isRequired,
  timeLabelHeight: PropTypes.number.isRequired,
  onEditEvent: PropTypes.func,
  editingEventId: PropTypes.number,
  highlightLineStyle: PropTypes.object,
};

export default React.memo(Events);
