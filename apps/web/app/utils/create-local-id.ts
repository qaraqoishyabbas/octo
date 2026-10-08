type CryptoWithRandomUUID = {
  randomUUID?: () => string;
};

export const createLocalId = (cryptoApi: CryptoWithRandomUUID = globalThis.crypto): string => {
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};
