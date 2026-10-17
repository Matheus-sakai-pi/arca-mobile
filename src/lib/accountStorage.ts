import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAccountStorage } from './accountStorageGuard';

export const accountStorage = createAccountStorage(AsyncStorage);
