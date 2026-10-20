import { Redirect } from 'expo-router';

// A trilha agora é única, na aba Aprender. Links antigos para uma unidade levam para lá.
export default function UnitJourney() {
  return <Redirect href="/(tabs)/learn" />;
}
