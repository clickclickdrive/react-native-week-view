import { StyleSheet } from 'react-native';
import { HEADER_HEIGHT } from '../utils/dimensions';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    alignItems: 'stretch',
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
  },
});

export default styles;
