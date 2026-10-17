export type Relationship = 'none' | 'friend' | 'incoming' | 'outgoing';
export type FriendAction = 'request' | 'accept' | 'decline' | 'cancel' | 'remove';
export type Person = { id: string; username: string; display_name: string; avatar_key: string; relationship: Relationship };
export type Friends = { friends: Person[]; incoming: Person[]; outgoing: Person[] };
