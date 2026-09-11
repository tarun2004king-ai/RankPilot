import Analysis from "../models/Analysis.js";
import {scrapeUrl} from "../services/scraperService.js";
import {analyzeSeoData} from "../services/geminiService.js";

//Analyze a URL
export const analyzeUrl = async (req, res) => {
    try{
        const {url} = req.body;
        if(!url){
            return res.status(400).json({success: false, message: "URL is required"})
        }

        //Valid Url format
        let validUrl;
        try{
            validUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
        }
        catch(err){
            return res.status(400).json({success: false, message: "Invalid URL format"})
        }

        //Create Analysis record with status pending
        const analysis = await Analysis.create({
            userId: req.userId,
            url: validUrl.href,
            status: "processing"
        });

        res.json({success: true, message: "Analysis started", analysisId: analysis._id})

        //1. Run scrapping and analysis in background
        try{
            const scrapeResult = await scrapeUrl(validUrl.href);
            if(!scrapeResult.success){
                analysis.status = "failed";
                await analysis.save();
                return;
            }

            //2. Analyze with Gemini AI
            const aiResult = await analyzeSeoData(scrapeResult.data);

            if(!aiResult.success){
                analysis.status = "failed";
                await analysis.save();
                return;
            }

            //3. Save result
            analysis.overallScore = aiResult.data.overallScore || 0;
            analysis.categories = aiResult.data.categories || {};
            analysis.keywords = aiResult.data.keywords || [];
            analysis.issues = aiResult.data.issues || [];
            analysis.metaData = scrapeResult.data.metaData || {};
            analysis.headings = scrapeResult.data.headings || {};
            analysis.links = scrapeResult.data.links || {};
            analysis.images = scrapeResult.data.images || {};
            analysis.loadTime = scrapeResult.data.loadTime || 0;
            analysis.pageSize = scrapeResult.data.pageSize || 0;
            analysis.wordCount = scrapeResult.data.wordCount || 0;
            analysis.status = "completed";

            await analysis.save();

        }
        catch(bgErr){
            console.error("Background Analysis Error", bgErr.message);
            try{
                analysis.status = "failed";
                await analysis.save();
            }
            catch(err){
                console.error("Failed to save failed status", err.message);
            }
        }
    }
    catch(err){
        console.error("Analyze URL Error", err.message);
        if(!res.headersSent){
            res.status(500).json({success: false, message: "Server error"})
        }
    }
}

//Get Analysis By ID
export const getAnalysis = async (req, res) => {
    try{
        const analysis = await Analysis.findOne({_id: req.params.id, userId: req.userId});
        if(!analysis){
            return res.status(404).json({success: false, message: "Analysis not found"})
        }
        res.json({success: true, analysis});
    }
    catch(err){
        console.error("Get Analysis Error", err.message);
        res.status(500).json({success: false, message: "Server error"})
    }
}

//Get all Analysis of user
export const getAnalyses = async (req, res) => {
    try{
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const analyses = await Analysis.find({userId: req.userId})
            .sort({createdAt: -1})
            .skip(skip)
            .limit(limit)
            .select("-issues -keywords");

            const total = await Analysis.countDocuments({userId: req.userId});

            res.json({
                success : true,
                analyses,
                pagination: {
                    page ,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
    }
    catch(err){
        console.error("Get Analyses Error", err.message);
        res.status(500).json({success: false, message: "Server error"})
    }
}

//Delete Analysis By ID
export const deleteAnalysis = async (req, res) => {
    try{
        await Analysis.findOneAndDelete({_id: req.params.id, userId: req.userId});
        res.json({success: true, message: "Analysis deleted successfully"});
    }
    catch(err){
        console.error("Delete Analysis Error", err.message);
        res.status(500).json({success: false, message: "Server error"});
    }
}
