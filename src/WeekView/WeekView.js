import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  ScrollView,
  Animated,
  VirtualizedList,
  InteractionManager,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import moment from 'moment';
import memoizeOne from 'memoize-one';

import Events from '../Events/Events';
import Header from '../Header/Header';
import Title from '../Title/Title';
import Times from '../Times/Times';
import styles from './WeekView.styles';
import bucketEventsByDate from '../pipeline/box';
import {
  DATE_STR_FORMAT,
  availableNumberOfDays,
  setLocale,
} from '../utils/dates';
import {
  minutesInDayToTop,
  topToSecondsInDay,
  computeVerticalDimensions,
  computeHorizontalDimensions,
} from '../utils/dimensions';
import {
  GridRowPropType,
  GridColumnPropType,
  EditEventConfigPropType,
  EventPropType,
  // DragEventConfigPropType,
} from '../utils/types';

const MINUTES_IN_DAY = 60 * 24;
const calculateTimesArray = (
  minutesStep,
  formatTimeLabel,
  beginAt = 0,
  endAt = MINUTES_IN_DAY,
) => {
  const times = [];
  const startOfDay = moment().startOf('day');
  for (
    let timer = beginAt >= 0 && beginAt < MINUTES_IN_DAY ? beginAt : 0;
    timer < endAt && timer < MINUTES_IN_DAY;
    timer += minutesStep
  ) {
    const time = startOfDay.clone().minutes(timer);
    times.push(time.format(formatTimeLabel));
  }

  return times;
};

// FlatList configuration
const PAGES_OFFSET = 2;
const DEFAULT_WINDOW_SIZE = PAGES_OFFSET * 2 + 1;

const calculatePagesDates = (
  currentMoment,
  numberOfDays,
  weekStartsOn,
  prependMostRecent,
  fixedHorizontally,
) => {
  const initialDates = [];
  const centralDate = moment(currentMoment);
  if (numberOfDays === 7 || fixedHorizontally) {
    centralDate.subtract(
      // Ensure centralDate is before currentMoment
      (centralDate.day() + 7 - weekStartsOn) % 7,
      'days',
    );
  }
  for (let i = -PAGES_OFFSET; i <= PAGES_OFFSET; i += 1) {
    const initialDate = moment(centralDate).add(numberOfDays * i, 'd');
    initialDates.push(initialDate.format(DATE_STR_FORMAT));
  }
  return prependMostRecent ? initialDates.reverse() : initialDates;
};

export default class WeekView extends Component {
  constructor(props) {
    super(props);
    this.eventsGrid = null;
    this.verticalAgenda = null;
    this.header = null;
    this.currentPageIndex = PAGES_OFFSET;
    this.eventsGridScrollX = new Animated.Value(0);
    this.headerScrollX = new Animated.Value(0);

    const initialDates = calculatePagesDates(
      props.selectedDate,
      props.numberOfDays,
      props.weekStartsOn,
      props.prependMostRecent,
      props.fixedHorizontally,
    );
    const { width: windowWidth, height: windowHeight } = Dimensions.get(
      'window',
    );
    this.state = {
      // currentMoment should always be the first date of the current page
      currentMoment: moment(initialDates[this.currentPageIndex]).toDate(),
      initialDates,
      windowWidth,
      windowHeight,
      isHeaderScrolling: false,
      isEventScrolling: false,
    };

    setLocale(props.locale);

    this.dimensions = {};
  }

  componentDidMount() {
    requestAnimationFrame(() => {
      this.scrollToVerticalStart();
    });

    this.eventsGridScrollX.addListener((position) => {
      if (this.state.isEventScrolling) {
        this.header.scrollToOffset({ offset: position.value, animated: false });
      }
    });

    this.headerScrollX.addListener((position) => {
      if (this.state.isHeaderScrolling) {
        this.eventsGrid.scrollToOffset({
          offset: position.value,
          animated: false,
        });
      }
    });

    this.windowListener = Dimensions.addEventListener(
      'change',
      ({ window }) => {
        const { width: windowWidth, height: windowHeight } = window;
        this.setState({ windowWidth, windowHeight });
      },
    );
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.locale !== prevProps.locale) {
      setLocale(this.props.locale);
    }

    if (
      prevProps?.selectedDate.toDateString() !==
      this.props.selectedDate.toDateString()
    ) {
      const initialDates = calculatePagesDates(
        // eslint-disable-next-line react/no-access-state-in-setstate
        this.props.selectedDate,
        this.props.numberOfDays,
        1, // weekStartsOn equal to 1 means Monday
        this.props.fixedHorizontally,
      );

      this.currentPageIndex = PAGES_OFFSET;
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(
        {
          currentMoment: moment(initialDates[this.currentPageIndex]).toDate(),
          initialDates,
        },
        () => {
          this.eventsGrid.scrollToIndex({
            index: PAGES_OFFSET,
            animated: false,
          });
          this.header.scrollToIndex({
            index: PAGES_OFFSET,
            animated: false,
          });
        },
      );
    }
    if (this.props.numberOfDays !== prevProps.numberOfDays) {
      /**
       * HOTFIX: linter rules no-access-state-in-setstate and no-did-update-set-state
       * are disabled here for now.
       * TODO: apply a better solution for the `currentMoment` and `initialDates` logic,
       * without using componentDidUpdate()
       */
      const initialDates = calculatePagesDates(
        // eslint-disable-next-line react/no-access-state-in-setstate
        this.state.currentMoment,
        this.props.numberOfDays,
        this.props.prependMostRecent,
        this.props.fixedHorizontally,
      );

      this.currentPageIndex = PAGES_OFFSET;
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(
        {
          currentMoment: moment(initialDates[this.currentPageIndex]).toDate(),
          initialDates,
        },
        () => {
          this.eventsGrid.scrollToIndex({
            index: PAGES_OFFSET,
            animated: false,
          });
        },
      );
    }
    if (this.state.windowWidth !== prevState.windowWidth) {
      // NOTE: after a width change, the position may be off by a few days
      this.eventsGrid.scrollToIndex({
        index: this.currentPageIndex,
        animated: false,
      });
    }
  }

  componentWillUnmount() {
    this.eventsGridScrollX.removeAllListeners();
    this.headerScrollX.removeAllListeners();
    if (this.windowListener) {
      this.windowListener.remove();
    }
  }

  calculateTimes = memoizeOne(calculateTimesArray);

  scrollToVerticalStart = () => {
    this.scrollToTime(this.props.startHour * 60, { animated: false });
  };

  scrollToTime = (minutes, options = {}) => {
    if (this.verticalAgenda) {
      const { animated = false } = options || {};
      const { beginAgendaAt } = this.props;
      const top = minutesInDayToTop(
        minutes,
        this.dimensions.verticalResolution,
        beginAgendaAt,
      );
      this.verticalAgenda.scrollTo({
        y: top,
        x: 0,
        animated,
      });
    }
  };

  verticalScrollBegun = () => {
    this.isScrollingVertical = true;
  };

  verticalScrollEnded = (scrollEvent) => {
    if (!this.isScrollingVertical) {
      // Ensure the callback is called only once, same as with horizontal case
      return;
    }
    this.isScrollingVertical = false;

    const { onTimeScrolled, beginAgendaAt } = this.props;

    if (!onTimeScrolled) {
      return;
    }

    const {
      nativeEvent: { contentOffset },
    } = scrollEvent;
    const { y: yPosition } = contentOffset;

    const secondsInDay = topToSecondsInDay(
      yPosition,
      this.dimensions.verticalResolution,
      beginAgendaAt,
    );

    const date = moment(this.state.currentMoment)
      .startOf('day')
      .seconds(secondsInDay)
      .toDate();

    onTimeScrolled(date);
  };

  isAppendingTheFuture = () => !this.props.prependMostRecent;

  getSignToTheFuture = () => (this.isAppendingTheFuture() ? 1 : -1);

  buildPages = (fromDate, nPages, appending) => {
    const timeSign = this.isAppendingTheFuture() === !!appending ? 1 : -1;
    const deltaDays = timeSign * this.props.numberOfDays;

    const newPages = Array.from({ length: nPages }, (_, index) =>
      moment(fromDate)
        .add((index + 1) * deltaDays, 'days')
        .format(DATE_STR_FORMAT),
    );
    return appending ? newPages : newPages.reverse();
  };

  goToDate = (targetDate, animated = true) => {
    const { initialDates } = this.state;
    const { numberOfDays } = this.props;

    const currentDate = moment(initialDates[this.currentPageIndex]).startOf(
      'day',
    );
    const deltaDay = moment(targetDate).startOf('day').diff(currentDate, 'day');
    const deltaIndex = Math.floor(deltaDay / numberOfDays);
    const signToTheFuture = this.getSignToTheFuture();
    const targetIndex = this.currentPageIndex + deltaIndex * signToTheFuture;

    this.goToPageIndex(targetIndex, animated);
  };

  goToNextPage = (animated = true) => {
    this.goToPageIndex(
      this.currentPageIndex + 1 * this.getSignToTheFuture(),
      animated,
    );
  };

  goToPrevPage = (animated = true) => {
    this.goToPageIndex(
      this.currentPageIndex - 1 * this.getSignToTheFuture(),
      animated,
    );
  };

  /**
   * Moves the view to a pageIndex.
   *
   * Add more pages (if necessary), scrolls the VirtualizedList to the new index,
   * and updates this.currentPageIndex.
   *
   * @param {Number} target index between (-infinity, infinity) indicating target page.
   * @param {bool} animated
   * @returns
   */
  goToPageIndex = (target, animated = true) => {
    if (target === this.currentPageIndex) {
      return;
    }

    const { initialDates } = this.state;

    const scrollTo = (moveToIndex) => {
      this.eventsGrid.scrollToIndex({
        index: moveToIndex,
        animated,
      });
      this.header.scrollToIndex({ index: moveToIndex, animated });
      this.currentPageIndex = moveToIndex;
    };

    const newState = {};
    let newStateCallback = () => {};

    // The final target will change (will be re-indexed) if pages are added in either direction
    let targetIndex = target;

    const firstViewablePage = PAGES_OFFSET;
    const lastViewablePage = initialDates.length - PAGES_OFFSET;

    if (targetIndex < firstViewablePage) {
      const prependNeeded = firstViewablePage - targetIndex;

      newState.initialDates = [
        ...this.buildPages(initialDates[0], prependNeeded, false),
        ...initialDates,
      ];
      targetIndex = PAGES_OFFSET;

      newStateCallback = () => setTimeout(() => scrollTo(targetIndex), 0);
    } else if (targetIndex > lastViewablePage) {
      const appendNeeded = targetIndex - lastViewablePage;
      newState.initialDates = [
        ...initialDates,
        ...this.buildPages(
          initialDates[initialDates.length - 1],
          appendNeeded,
          true,
        ),
      ];

      targetIndex = newState.initialDates.length - PAGES_OFFSET;

      newStateCallback = () => setTimeout(() => scrollTo(targetIndex), 0);
    } else {
      scrollTo(targetIndex);
    }

    newState.currentMoment = moment(initialDates[targetIndex]).toDate();
    this.setState(newState, newStateCallback);
  };

  scrollBegun = () => {
    this.isScrollingHorizontal = true;
  };

  scrollEnded = (event) => {
    if (!this.isScrollingHorizontal) {
      // Ensure the callback is called only once
      return;
    }
    this.isScrollingHorizontal = false;

    const {
      nativeEvent: { contentOffset },
    } = event;
    const { x: position } = contentOffset;
    const { pageWidth } = this.dimensions;
    const { initialDates } = this.state;

    const newPageIndex = Math.round(position / pageWidth);
    const movedPages = newPageIndex - this.currentPageIndex;
    this.currentPageIndex = newPageIndex;

    if (movedPages === 0) {
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      const newMoment = moment(initialDates[this.currentPageIndex]).toDate();
      const newState = {
        currentMoment: newMoment,
      };
      let newStateCallback = () => {};

      const buffer = PAGES_OFFSET;
      const pagesToStartOfList = newPageIndex;
      const pagesToEndOfList = initialDates.length - newPageIndex - 1;

      if (movedPages < 0 && pagesToStartOfList < buffer) {
        const prependNeeded = buffer - pagesToStartOfList;

        newState.initialDates = [
          ...this.buildPages(initialDates[0], prependNeeded, false),
          ...initialDates,
        ];

        // After prepending, it needs to scroll to fix its position,
        // to mantain visible content position (mvcp)
        this.currentPageIndex += prependNeeded;
        const scrollToCurrentIndex = () => {
          this.eventsGrid.scrollToIndex({
            index: this.currentPageIndex,
            animated: false,
          });
          this.header.scrollToIndex({
            index: this.currentPageIndex,
            animated: false,
          });
        };
        newStateCallback = () => setTimeout(scrollToCurrentIndex, 0);
      } else if (movedPages > 0 && pagesToEndOfList < buffer) {
        const appendNeeded = buffer - pagesToEndOfList;
        newState.initialDates = [
          ...initialDates,
          ...this.buildPages(
            initialDates[initialDates.length - 1],
            appendNeeded,
            true,
          ),
        ];
      }

      this.setState(newState, newStateCallback);

      const {
        onSwipePrev: onSwipeToThePast,
        onSwipeNext: onSwipeToTheFuture,
      } = this.props;
      const movedForward = movedPages > 0;
      const callback =
        this.isAppendingTheFuture() === movedForward
          ? onSwipeToTheFuture
          : onSwipeToThePast;
      if (callback) {
        callback(newMoment);
      }
    });
  };

  eventsGridRef = (ref) => {
    this.eventsGrid = ref;
  };

  verticalAgendaRef = (ref) => {
    this.verticalAgenda = ref;
  };

  headerRef = (ref) => {
    this.header = ref;
  };

  bucketEventsByDate = memoizeOne(bucketEventsByDate);

  getListItemLayout = (item, index) => {
    const pageWidth = this.dimensions.pageWidth || 0;
    return {
      length: pageWidth,
      offset: pageWidth * index,
      index,
    };
  };

  render() {
    const {
      showTitle,
      numberOfDays,
      headerStyle,
      headerTextStyle,
      hourTextStyle,
      gridRowStyle,
      gridColumnStyle,
      eventContainerStyle,
      DayHeaderComponent,
      TodayHeaderComponent,
      formatDateHeader,
      timesColumnWidth,
      onEventPress,
      onEventLongPress,
      events,
      hoursInDisplay,
      timeStep,
      beginAgendaAt,
      endAgendaAt,
      formatTimeLabel,
      onGridClick,
      onGridLongPress,
      onEditEvent,
      editEventConfig,
      editingEvent,
      EventComponent,
      prependMostRecent,
      rightToLeft,
      fixedHorizontally,
      showNowLine,
      nowLineColor,
      dragEventConfig,
      onDragEvent,
      onMonthPress,
      onDayPress,
      isRefreshing,
      windowSize,
      initialNumToRender,
      maxToRenderPerBatch,
      updateCellsBatchingPeriod,
      // new Props
      onRefresh,
      CustomTitleComponent,
      headerContainerStyle,
      columnHeaderStyle,
      CustomHeaderComponent,
      CustomWeekViewHeaderComponent,
      isError,
      ErrorComponent,
      zoomingScale,
      animatedGridStyle,
      highlightLineStyle,
      hideMinuteSteps,
    } = this.props;
    const {
      currentMoment,
      initialDates,
      windowWidth,
      windowHeight,
    } = this.state;
    const times = this.calculateTimes(
      timeStep,
      formatTimeLabel,
      beginAgendaAt,
      endAgendaAt,
    );
    const eventsByDate = this.bucketEventsByDate(events);
    const horizontalInverted =
      (prependMostRecent && !rightToLeft) ||
      (!prependMostRecent && rightToLeft);

    const {
      pageWidth,
      dayWidth,
      timeLabelsWidth,
    } = computeHorizontalDimensions(
      windowWidth,
      numberOfDays,
      timesColumnWidth,
    );

    const {
      timeLabelHeight,
      resolution: verticalResolution,
    } = computeVerticalDimensions(windowHeight, hoursInDisplay, timeStep);

    this.dimensions = {
      pageWidth,
      verticalResolution,
    };

    return (
      <GestureHandlerRootView style={styles.container}>
        {CustomWeekViewHeaderComponent && <CustomWeekViewHeaderComponent />}
        <View style={[styles.headerContainer, headerContainerStyle]}>
          <Title
            style={headerStyle}
            showTitle={showTitle}
            width={timeLabelsWidth}
            textStyle={headerTextStyle}
            numberOfDays={numberOfDays}
            selectedDate={currentMoment}
            onMonthPress={onMonthPress}
            CustomTitleComponent={CustomTitleComponent}
          />
          <VirtualizedList
            horizontal
            pagingEnabled
            inverted={horizontalInverted}
            showsHorizontalScrollIndicator={false}
            onStartShouldSetResponderCapture={() => false}
            onMoveShouldSetResponderCapture={() => false}
            onResponderTerminationRequest={() => false}
            ref={this.headerRef}
            data={initialDates}
            getItem={(data, index) => data[index]}
            getItemCount={(data) => data.length}
            getItemLayout={this.getListItemLayout}
            keyExtractor={(item) => item}
            initialScrollIndex={PAGES_OFFSET}
            extraData={dayWidth}
            windowSize={windowSize}
            initialNumToRender={initialNumToRender}
            maxToRenderPerBatch={maxToRenderPerBatch}
            updateCellsBatchingPeriod={updateCellsBatchingPeriod}
            onScrollBeginDrag={() => this.setState({ isHeaderScrolling: true })}
            onMomentumScrollBegin={() => {
              this.scrollBegun();
            }}
            onMomentumScrollEnd={(event) => {
              this.setState({ isHeaderScrolling: false });
              this.scrollEnded(event);
            }}
            onScroll={Animated.event(
              [
                {
                  nativeEvent: {
                    contentOffset: {
                      x: this.headerScrollX,
                    },
                  },
                },
              ],
              { useNativeDriver: false },
            )}
            renderItem={({ item }) => {
              return (
                <Header
                  key={item}
                  style={headerStyle}
                  textStyle={headerTextStyle}
                  TodayComponent={TodayHeaderComponent}
                  DayComponent={DayHeaderComponent}
                  formatDate={formatDateHeader}
                  initialDate={item}
                  numberOfDays={numberOfDays}
                  rightToLeft={rightToLeft}
                  onDayPress={onDayPress}
                  dayWidth={dayWidth}
                  CustomHeaderComponent={CustomHeaderComponent}
                  columnHeaderStyle={columnHeaderStyle}
                />
              );
            }}
          />
        </View>
        {isError ? (
          <ErrorComponent />
        ) : (
          <ScrollView
            onStartShouldSetResponderCapture={() => false}
            onMoveShouldSetResponderCapture={() => false}
            onResponderTerminationRequest={() => false}
            contentContainerStyle={
              Platform.OS === 'web' && styles.webScrollView
            }
            onMomentumScrollBegin={this.verticalScrollBegun}
            onMomentumScrollEnd={this.verticalScrollEnded}
            ref={this.verticalAgendaRef}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
            }
          >
            <View style={styles.scrollViewContent}>
              <Times
                times={times}
                textStyle={hourTextStyle}
                timeLabelHeight={timeLabelHeight}
                width={timeLabelsWidth}
                hideMinuteSteps={hideMinuteSteps}
                animatedGridStyle={animatedGridStyle}
              />
              <VirtualizedList
                data={initialDates}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                getItem={(data, index) => data[index]}
                getItemCount={(data) => data.length}
                getItemLayout={this.getListItemLayout}
                keyExtractor={(item) => item}
                initialScrollIndex={PAGES_OFFSET}
                scrollEnabled={!fixedHorizontally}
                onStartShouldSetResponderCapture={() => false}
                onMoveShouldSetResponderCapture={() => false}
                onResponderTerminationRequest={() => false}
                renderItem={({ item }) => {
                  return (
                    <Events
                      times={times}
                      eventsByDate={eventsByDate}
                      initialDate={item}
                      numberOfDays={numberOfDays}
                      onEventPress={onEventPress}
                      onEventLongPress={onEventLongPress}
                      onGridClick={onGridClick}
                      onGridLongPress={onGridLongPress}
                      beginAgendaAt={beginAgendaAt}
                      timeLabelHeight={timeLabelHeight}
                      EventComponent={EventComponent}
                      eventContainerStyle={eventContainerStyle}
                      gridRowStyle={gridRowStyle}
                      gridColumnStyle={gridColumnStyle}
                      rightToLeft={rightToLeft}
                      showNowLine={showNowLine}
                      nowLineColor={nowLineColor}
                      onDragEvent={onDragEvent}
                      pageWidth={pageWidth}
                      dayWidth={dayWidth}
                      verticalResolution={verticalResolution}
                      onEditEvent={onEditEvent}
                      editingEventId={editingEvent}
                      editEventConfig={editEventConfig}
                      dragEventConfig={dragEventConfig}
                      zoomingScale={zoomingScale}
                      animatedGridStyle={animatedGridStyle}
                      highlightLineStyle={highlightLineStyle}
                      hideMinuteSteps={hideMinuteSteps}
                    />
                  );
                }}
                horizontal
                pagingEnabled
                inverted={horizontalInverted}
                onScrollBeginDrag={() => {
                  this.setState({ isEventScrolling: true });
                }}
                onMomentumScrollBegin={() => {
                  this.scrollBegun();
                }}
                onMomentumScrollEnd={(event) => {
                  this.setState({ isEventScrolling: false });
                  this.scrollEnded(event);
                }}
                scrollEventThrottle={32}
                onScroll={Animated.event(
                  [
                    {
                      nativeEvent: {
                        contentOffset: {
                          x: this.eventsGridScrollX,
                        },
                      },
                    },
                  ],
                  { useNativeDriver: false },
                )}
                ref={this.eventsGridRef}
                windowSize={windowSize}
                initialNumToRender={initialNumToRender}
                maxToRenderPerBatch={maxToRenderPerBatch}
                updateCellsBatchingPeriod={updateCellsBatchingPeriod}
                accessible
                accessibilityLabel="Grid with horizontal scroll"
                accessibilityHint="Grid with horizontal scroll"
              />
            </View>
          </ScrollView>
        )}
      </GestureHandlerRootView>
    );
  }
}

WeekView.propTypes = {
  events: PropTypes.arrayOf(EventPropType),
  formatDateHeader: PropTypes.string,
  numberOfDays: PropTypes.oneOf(availableNumberOfDays).isRequired,
  timesColumnWidth: PropTypes.number,
  weekStartsOn: PropTypes.number,
  onSwipeNext: PropTypes.func,
  onSwipePrev: PropTypes.func,
  onTimeScrolled: PropTypes.func,
  onEventPress: PropTypes.func,
  onEventLongPress: PropTypes.func,
  onGridClick: PropTypes.func,
  onGridLongPress: PropTypes.func,
  editingEvent: PropTypes.number,
  onEditEvent: PropTypes.func,
  editEventConfig: EditEventConfigPropType,
  headerStyle: PropTypes.object,
  headerTextStyle: PropTypes.object,
  hourTextStyle: PropTypes.object,
  eventContainerStyle: PropTypes.object,
  gridRowStyle: GridRowPropType,
  gridColumnStyle: GridColumnPropType,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  locale: PropTypes.string,
  hoursInDisplay: PropTypes.number,
  timeStep: PropTypes.number,
  beginAgendaAt: PropTypes.number,
  endAgendaAt: PropTypes.number,
  formatTimeLabel: PropTypes.string,
  startHour: PropTypes.number,
  EventComponent: PropTypes.elementType,
  DayHeaderComponent: PropTypes.elementType,
  TodayHeaderComponent: PropTypes.elementType,
  showTitle: PropTypes.bool,
  rightToLeft: PropTypes.bool,
  fixedHorizontally: PropTypes.bool,
  prependMostRecent: PropTypes.bool,
  showNowLine: PropTypes.bool,
  nowLineColor: PropTypes.string,
  onDragEvent: PropTypes.func,
  onMonthPress: PropTypes.func,
  onDayPress: PropTypes.func,
  isRefreshing: PropTypes.bool,
  windowSize: PropTypes.number,
  initialNumToRender: PropTypes.number,
  maxToRenderPerBatch: PropTypes.number,
  updateCellsBatchingPeriod: PropTypes.number,
  // new Props
  headerContainerStyle: PropTypes.object,
  columnHeaderStyle: PropTypes.object,
  CustomTitleComponent: PropTypes.elementType,
  CustomHeaderComponent: PropTypes.elementType,
  CustomWeekViewHeaderComponent: PropTypes.elementType,
  onRefresh: PropTypes.func,
  isError: PropTypes.bool,
  ErrorComponent: PropTypes.elementType,
  highlightLineStyle: PropTypes.object,
};

WeekView.defaultProps = {
  events: [],
  locale: 'en',
  hoursInDisplay: 20,
  weekStartsOn: 1,
  timeStep: 60,
  beginAgendaAt: 0,
  endAgendaAt: MINUTES_IN_DAY,
  formatTimeLabel: 'H:mm',
  startHour: 8,
  showTitle: true,
  rightToLeft: false,
  prependMostRecent: false,
  windowSize: DEFAULT_WINDOW_SIZE,
  initialNumToRender: DEFAULT_WINDOW_SIZE,
  maxToRenderPerBatch: PAGES_OFFSET,
  updateCellsBatchingPeriod: 50, // RN default
  highlightLineStyle: {
    borderTopWidth: 1.25,
    borderTopColor: '#ccd0d4',
  },
};
