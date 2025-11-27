// pages/api/comment-manager.js

import { getToken } from "next-auth/jwt";
import { PrismaClient } from '@prisma/client';

// Cấu hình JWT Secret
const secret = process.env.NEXTAUTH_SECRET;

// 1. KHỞI TẠO PRISMA CLIENT
let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default async function handler(req, res) {
    
    let access_token = ""
    if (req.body && req.body.accessToken) {
            access_token = req.body.accessToken;
        }
    else {
        if(req.query && req.query.accessToken){
            access_token = req.query.accessToken;
        }else{
            // Nếu không khớp, kiểm tra xác thực người dùng (Frontend-to-Server)
            const token = await getToken({ req, secret });
            if (!token || !token.accessToken) {
                return res.status(401).json({ message: 'Not authenticated or missing internal secret.' });
            }
            access_token = token.accessToken;
        }
    }

    try {
        switch (req.method) {
            
            case 'GET':
                
                const { cid } = req.query; // Lấy ID từ req.query
                if(cid){
                    const comment = await prisma.FacebookComment.findUnique({
                        where: { id: String(cid) },
                    });
                    
                    if (!comment) {
                        return res.status(404).json({ message: 'Comment not found.' });
                    }
                    return res.status(200).json({ comment });
                }
                else{
                    const comments = await prisma.FacebookComment.findMany({
                        orderBy: { CreatedDate: 'desc' },
                    });
                    return res.status(200).json({ comments });
                }
                
            // --- CREATE COMMENT (POST) ---
            case 'POST':
                const { name: postName, content: postContent } = req.body;

                if (!postName || !postContent) {
                    return res.status(400).json({ message: 'Name and Content are required.' });
                }

                const newComment = await prisma.FacebookComment.create({
                    data: {
                        name: postName,
                        content: postContent,
                    },
                });
                return res.status(201).json({ comment: newComment, message: 'Comment created successfully.' });

            // --- UPDATE COMMENT (PUT) ---
            case 'PUT':
                const { id: putId, name: putName, content: putContent } = req.body;
                
                if (!putId || !putName || !putContent) {
                    return res.status(400).json({ message: 'ID, Name, and Content are required for update.' });
                }

                const updatedComment = await prisma.FacebookComment.update({
                    where: { id: putId },
                    data: {
                        name: putName,
                        content: putContent,
                    },
                });
                return res.status(200).json({ comment: updatedComment, message: 'Comment updated successfully.' });

            // --- DELETE COMMENT (DELETE) ---
            case 'DELETE':
                const { id: deleteId } = req.body;
                
                if (!deleteId) {
                    return res.status(400).json({ message: 'Comment ID is required for deletion.' });
                }
                
                await prisma.FacebookComment.delete({
                    where: { id: deleteId },
                });
                return res.status(200).json({ message: 'Comment deleted successfully.' });

            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        console.error('Database Operation Error:', error);
        
        if (error.code === 'P2025') {
             return res.status(404).json({ message: 'Record not found in database.', error: error.message });
        }
        
        return res.status(500).json({ message: 'Database operation failed.', error: error.message });
    }
}