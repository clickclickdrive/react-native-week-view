import {Dimensions} from 'react-native';

const {height: HEIGHT} = Dimensions.get('window');

export const HOURS_IN_DISPLAY = 10;
export const DEFAULT_TIME_STEP = 15;

// Default scale is 1, max and min scale to limit zooming(avoid infinite zooming)
// inferior scale to display/hide the 15minsLines between hours ( hide 15minsLines if scale < 0.7)
export const MAX_SCALE = 2.5,
  INFERIOR_SCALE = 0.7,
  MIN_SCALE = 0.4;

const computeGridDefaultHeight = (
  hoursInDisplay = HOURS_IN_DISPLAY,
  minutesStep = DEFAULT_TIME_STEP,
) => {
  const minutesInDisplay = hoursInDisplay * 60;
  const timeLabelsInDisplay = Math.ceil(minutesInDisplay / minutesStep);

  return HEIGHT / timeLabelsInDisplay;
};

// Default height of the grid & event Time & event Line
export const defaultGridHeight = computeGridDefaultHeight();
