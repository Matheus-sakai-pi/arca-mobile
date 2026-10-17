import { redesignAssets } from './redesignAssets';

export const unitArtwork = {
  'conhecendo-a-biblia': { image: redesignAssets.bibleClosed, caption: 'Sua jornada pela Palavra', icon: 'book' },
  'personagens-e-historias': { image: redesignAssets.thinking, caption: 'Grandes figuras da fé', icon: 'people' },
  'genesis-e-patriarcas': { image: require('../../assets/units/genesis.png'), caption: 'Dos começos à promessa', icon: 'sprout' },
  'exodo-e-deserto': { image: require('../../assets/units/exodus.png'), caption: 'Libertação e uma nova aliança', icon: 'scroll' },
  'reis-poesia-e-sabedoria': { image: require('../../assets/units/kings.png'), caption: 'Coragem, cânticos e sabedoria', icon: 'crown' },
  'profetas-e-reconstrucao': { image: require('../../assets/units/prophets.png'), caption: 'Chamados de fé e esperança', icon: 'scroll' },
  'vida-de-jesus': { image: require('../../assets/units/jesus.png'), caption: 'Os caminhos dos Evangelhos', icon: 'fish' },
  'ensinamentos-e-parabolas': { image: require('../../assets/units/parables.png'), caption: 'Histórias que transformam', icon: 'sprout' },
  'atos-e-primeiras-comunidades': { image: require('../../assets/units/acts.png'), caption: 'Uma mensagem que se espalha', icon: 'people' },
  'cartas-e-panorama-final': { image: require('../../assets/units/letters.png'), caption: 'Palavras para as comunidades', icon: 'mail' },
} as const;

export function artworkForUnit(id: string) {
  return unitArtwork[id as keyof typeof unitArtwork] ?? unitArtwork['conhecendo-a-biblia'];
}
