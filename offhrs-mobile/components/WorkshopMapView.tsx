import { Platform } from 'react-native';

import NativeWorkshopMapView from './WorkshopMapView.native';
import WebWorkshopMapView from './WorkshopMapView.web';

const WorkshopMapView = Platform.OS === 'web' ? WebWorkshopMapView : NativeWorkshopMapView;

export default WorkshopMapView;
