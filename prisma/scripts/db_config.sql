
CREATE UNIQUE INDEX wallet_unique_idx ON public."User" (LOWER("walletAddress"));