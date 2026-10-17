import { object } from './backendDecoders.ts';
import type { Friends, Person, Relationship } from '../types/friends.ts';

export function friendQuery(value: string) {
  const query = value.trim().replace(/^@+/, '').toLowerCase();
  return /^[a-z0-9_]{3,60}$/.test(query) ? query : null;
}
export function decodePeople(value: unknown, owner: string, relationship?: Relationship, max = 20): Person[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('Lista de pessoas inválida.');
  const people = value.map((row): Person => {
    if (!object(row) || typeof row.id !== 'string' || !row.id || row.id === owner
      || typeof row.username !== 'string' || !row.username.trim() || row.username.length > 60
      || typeof row.display_name !== 'string' || !row.display_name.trim() || row.display_name.length > 60
      || typeof row.avatar_key !== 'string' || !['none','friend','incoming','outgoing'].includes(String(row.relationship))
      || (relationship && row.relationship !== relationship)) throw new Error('Pessoa recebida em formato inválido.');
    return {id:row.id,username:row.username,display_name:row.display_name,avatar_key:row.avatar_key,relationship:row.relationship as Relationship};
  });
  if (new Set(people.map(row => row.id)).size !== people.length) throw new Error('Pessoa duplicada.');
  return people;
}
export function decodeFriends(value: unknown, owner: string): Friends {
  if (!object(value)) throw new Error('Lista de amigos inválida.');
  const result = {friends:decodePeople(value.friends,owner,'friend',200),incoming:decodePeople(value.incoming,owner,'incoming',200),outgoing:decodePeople(value.outgoing,owner,'outgoing',200)};
  const ids = Object.values(result).flat().map(person => person.id);
  if (new Set(ids).size !== ids.length) throw new Error('Amizade duplicada.');
  return result;
}
export function socialError(error: {code?: string; message?: string}) {
  if (['PGRST202','42883','42P01'].includes(error.code ?? '')) return 'Amigos e XP semanal ainda precisam ser habilitados no servidor.';
  if (error.message?.includes('friend_limit')) return 'Limite de amizades ou pedidos atingido. Cancele pedidos antigos antes de tentar novamente.';
  if (error.message?.includes('friend_person_missing')) return 'Esta conta não está mais disponível.';
  if (error.message?.includes('friend_accept_required')) return 'Esta pessoa já enviou um pedido. Aceite em Pedidos recebidos.';
  if (error.message?.includes('friend_not_')) return 'Este pedido mudou. Atualize a lista e tente novamente.';
  return 'Não foi possível acessar seus amigos. Confira a conexão e tente novamente.';
}
