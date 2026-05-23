const ASSET_ALIASES = {
  bitcoin: "BTC",
  ether: "ETH",
  ethereum: "ETH",
  tether: "USDT",
};

const CROSS_PERSPECTIVE_MAP = {
  TRANSFER_OUT: "TRANSFER_IN",
  TRANSFER_IN: "TRANSFER_OUT",
};

exports.normalizeAsset = (assetStr) => {
  if (!assetStr) return "";
  const clean = assetStr.trim().toLowerCase();
  return ASSET_ALIASES[clean] || assetStr.trim().toUpperCase();
};

exports.getEquivalentExchangeType = (userType) => {
  if (!userType) return "";
  const cleanType = userType.trim().toUpperCase();
  return CROSS_PERSPECTIVE_MAP[cleanType] || cleanType;
};
