-- TODO: ADD POINTS FOR LIQUIDITY
CREATE OR REPLACE FUNCTION update_points() RETURNS TRIGGER 
AS 
$BODY$
BEGIN
   IF (OLD."snapshotTS" > NEW."snapshotTS") THEN
       RAISE 'Cant use older snapshot timestamp';
   END IF;
   NEW."snapshotPoints" := OLD."snapshotPoints" + 
      (OLD."memeFTM" + OLD."memeETH") * 0.00001157407407 * 
	  (NEW."snapshotTS" - OLD."snapshotTS");
   RETURN NEW;
END;
$BODY$
LANGUAGE plpgsql;
--DROP TRIGGER trigger_update ON public."Reward";
CREATE TRIGGER trigger_update BEFORE UPDATE
ON public."Reward" 
FOR EACH ROW
WHEN (NEW."memeFTM" IS NOT NULL OR NEW."memeETH" IS NOT NULL 
	  OR NEW."liquidityFTM" IS NOT NULL)
EXECUTE PROCEDURE update_points();

CREATE OR REPLACE FUNCTION new_user() RETURNS TRIGGER 
AS 
$BODY$
BEGIN
   INSERT INTO public."Reward" ("address") VALUES (NEW."walletAddress");
   RETURN NEW;
END;
$BODY$
LANGUAGE plpgsql;

--DROP TRIGGER trigger_update ON public."Reward";
CREATE TRIGGER insert_user AFTER INSERT ON public."User"
    FOR EACH ROW
    EXECUTE FUNCTION public.new_user();

-- TODO: ADD POINTS FOR LIQUIDITY
CREATE OR REPLACE FUNCTION earned(wallet char, ts int)
RETURNS bigint
LANGUAGE plpgsql
AS
$$
DECLARE
   points integer;
BEGIN
	SELECT
    "snapshotPoints" + ("memeFTM" + "memeETH") * 0.00001157407407 * 
	  (ts - "snapshotTS")
   INTO points
   FROM "Reward"
   WHERE "address" = wallet;
   RETURN points;
END;
$$;