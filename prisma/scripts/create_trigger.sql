CREATE OR REPLACE FUNCTION update_reward() RETURNS TRIGGER 
AS 
$BODY$
BEGIN
   IF (OLD."blockTimestamp" > NEW."blockTimestamp") THEN
       RAISE 'Cant use older snapshot timestamp';
   END IF;
   NEW."snapshotPoints" := OLD."snapshotPoints" + 
      OLD."balance" * (SELECT "rewardRate" FROM public."RewardType" AS b WHERE b."type" = NEW."type")
       * (NEW."blockTimestamp" - OLD."blockTimestamp");
   RETURN NEW;

   INSERT INTO public."RewardHistory"
   ("address", "balance", "snapshotPoints", "blockTimestamp", "type", "txId")
   VALUES (NEW."address", NEW."balance", NEW."snapshotPoints", NEW."blockTimestamp", NEW."type", NEW."txId");
END;
$BODY$
LANGUAGE plpgsql;

--DROP TRIGGER insert_reward ON public."RewardCurrent";
CREATE TRIGGER insert_reward BEFORE UPDATE
ON public."RewardCurrent" 
FOR EACH ROW
WHEN (NEW."balance" IS NOT NULL)
EXECUTE PROCEDURE update_reward();

CREATE OR REPLACE FUNCTION new_user() RETURNS TRIGGER 
AS 
$BODY$
BEGIN
   INSERT INTO public."RewardCurrent" ("address", "type") VALUES (NEW."walletAddress", 'ETH_MEME');
   INSERT INTO public."RewardCurrent" ("address", "type") VALUES (NEW."walletAddress", 'FTM_MEME');
   INSERT INTO public."RewardCurrent" ("address", "type") VALUES (NEW."walletAddress", 'FTM_LIQ');
   RETURN NEW;
END;
$BODY$
LANGUAGE plpgsql;

--DROP TRIGGER trigger_update ON public."Reward";
CREATE TRIGGER insert_user AFTER INSERT ON public."User"
    FOR EACH ROW
    EXECUTE FUNCTION public.new_user();


CREATE UNIQUE INDEX wallet_unique_idx ON public."User" (LOWER("walletAddress"));