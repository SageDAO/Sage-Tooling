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