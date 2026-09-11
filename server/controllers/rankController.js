import KeywordTracking from "../models/KeywordTracking.js";
import { keywordTracking } from "../services/keywordTrackingService.js";

//Add a keyword to track
export const addKeyword = async (req, res) => {
    try{
        const {keyword , url } = req.body;

        if(!keyword || !url) {
            return res.status(400).json({success: false, message: "Keyword and URL are required"});
        }

        //Extract domain from URL
        let domain;
        try{
            const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
            domain = urlObj.hostname.replace("www.","")
        }
        catch(err){
            return res.status(400).json({
                success: false,
                message: "Invalid Url format"
            });
        }

        const existing = await KeywordTracking.findOne({userId: req.userId , keyword: keyword.toLowerCase().trim() , domain});

        if(existing){
            return res.status(400).json({
                success: false,
                message: "Keyword already being tracked for this domain"
            });
        }

        //Create new keyword tracking entry
        const tracking = await KeywordTracking.create({
            userId: req.userId,
            keyword: keyword.toLowerCase().trim(),
            url: url.startsWith("http") ? url : `https://${url}`,
            domain,
            status: "checking",
        })

        res.status(201).json({
            success: true,
            message: "Keyword tracking Started",
            tracking
        })

        keywordTracking(tracking)
        
    }
    catch(err){
        console.error("Add Keyword Error", err.message);
        if(err.code === 11000){
            return res.status(400).json({
                success: false,
                message: "Keyword already being tracked for this domain"
            });
        }
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
}


//Get all Tracked Keywords for a user
export const getKeywords = async (req, res) => {
    try{
        const keywords = await KeywordTracking.find({userId: req.userId}).sort({createdAt: -1}).
        select("-rankHistory")

        res.json({
            success: true,
            keywords
        })
    }
    catch(err){
        console.error("Get Keywords Error", err.message);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
}

//Get a single tracked keyword by ID with full history
export const getKeyword = async (req, res) => {
    try{
        const keyword = await KeywordTracking.findOne({_id: req.params.id , userId: req.userId});

        if(!keyword){
            return res.status(404).json({
                success: false,
                message: "Keyword not found"
            });
        }
        res.json({
            success: true,
            keyword
        })
    }
    catch(err){
        console.error("Get Keyword Error", err.message);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
}

//Manually refresh a keyword's rank data
export const refreshKeyword = async (req, res) => {
    try{
        const tracking = await KeywordTracking.findOne({_id: req.params.id , userId: req.userId});

        if(!tracking){
            return res.status(404).json({
                success: false,
                message: "Keyword not found"
            });
        }

        tracking.status = "checking";
        await tracking.save();
        res.json({
            success: true,
            message: "Rank check initiated"
        })

        keywordTracking(tracking)
    }
    catch(err){
        console.error("Refresh Keyword Error", err.message);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
    
}

//Delete a tracked keyword
export const deleteKeyword = async (req, res) => {
    try{
        const tracking = await KeywordTracking.findByIdAndDelete({_id: req.params.id , userId: req.userId});
        if(!tracking){
            return res.status(404).json({
                success: false,
                message: "Keyword not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Keyword tracking deleted"
        })
    }
    catch(err){
        console.error("Delete Keyword Error", err.message);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
}

//Toggle the active/inactive status of a tracked keyword
export const toggleTracking = async (req, res) => {
    try{
        const tracking = await KeywordTracking.findOne({_id: req.params.id , userId: req.userId});
        if(!tracking){
            return res.status(404).json({
                success: false,
                message: "Keyword not found"
            });
        }

        tracking.active = !tracking.active;
        await tracking.save();

        res.status(200).json({
            success: true,
            tracking
        })
    }
    catch(err){
        console.error("Toggle Tracking Error", err.message);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
}
