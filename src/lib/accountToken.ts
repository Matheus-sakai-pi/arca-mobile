type SessionReader = () => Promise<{ data:{session:{user:{id:string};access_token:string}|null}; error:unknown }>;

// Capture the checked owner's token, never the next account's token.
export function accountAccessToken(owner:string,read:SessionReader) {
  return async()=> {
    const {data,error}=await read();
    if (error) throw new Error('auth_unavailable');
    if (!data.session || data.session.user.id !== owner) throw new Error('account_changed');
    return data.session.access_token;
  };
}
