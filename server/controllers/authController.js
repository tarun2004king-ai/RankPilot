
import User from "../models/User.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import "dotenv/config"

//Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({id} , process.env.JWT_SECRET , {expiresIn : "30d"})
}

//Register User
export const register = async (req , res) => {
    try{
        const {name , email , password} = req.body;

        if(!name || !email || !password)
            return res.status(400).json({message : "Please fill all the fields"})

        //Check if user exits
        const user = await User.findOne({email})

        if(user)
            return res.status(400).json({message : "User already exists"})

        //Create new user
        const hashedPassword = await bcrypt.hash(password, 10)
        
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        })

        const token = generateToken(newUser._id)
        res.status(201).json({ success: true, token, user: newUser })
    }
    catch(err){
        console.error("Registration error" , err.message)
        res.status(500).json({success : false})
    }
}

//Login User
export const login = async (req , res) => {
    try{
        const {email , password} = req.body;

        if(!email || !password)
            return res.status(400).json({message : "Please fill all the fields"})

        //Check if user exits
        const user = await User.findOne({email})

        if(!user)
            return res.status(400).json({message : "Invalid credentials"})

        //Check password
        const isMatch = await bcrypt.compare(password, user.password)

        if(!isMatch)
            return res.status(400).json({message : "Invalid credentials"})

        const token = generateToken(user._id)
        res.status(200).json({success: true , token ,user})
    }
    catch(err){
        console.error("Login error" , err.message)
        res.status(500).json({success : false})
    }
}
        
//Get current user
export const getUser = async (req , res) => {
    try{
        const user = await User.findById(req.userId).select("-password");
        if(!user){
            return res.status(400).json({
                success:false,
                message: "User not found"
            })
        }

        res.json({success: true, user})
    }
    catch(err){
        console.error("Get user error" , err.message)
        res.status(500).json({success : false})
    }
}


