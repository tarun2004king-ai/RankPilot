import cron from "node-cron"
import KeywordTracking from "../models/KeywordTracking.js";
import { keywordTracking } from "../services/keywordTrackingService.js";


export function startRankTrackingCron(){
    cron.schedule("0 6 * * *" , async() =>{
        console.log("Starting Daily rank Tracking ...");

        try{
            const activeTrackings = await KeywordTracking.find({active : true})
            for(const tarcking of activeTrackings){
                tracking.status = "checking";
                await tracking.save()

                const result = await keywordTracking(tracking)
                //Delay b/w checks to avoid rate limit

                await new Promise((r) => setTimeout(r , 10000 + Math.random() * 50000))
            }
        }
        catch(err){
            console.error("[CRON] Rank tracking cron error: " , err.message);
        }
    })

    console.log("Rank tracking cron scheduled")
}