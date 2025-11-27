// pages/api/scheduler/check-and-post.js
import { getToken } from "next-auth/jwt";
import axios from 'axios'; // Cần cho việc gọi API Facebook
import { PrismaClient } from '@prisma/client';
import { comment } from "postcss";

const secret = process.env.NEXTAUTH_SECRET;
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
const ROOT_URL = process.env.ROOT_URLBASE || ''; 


let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

const processPostFacebook = async (content, accessToken,req) => {
    const { MainContent, VideoPath, ImageUrls, Comment, Name,TargetPageIds } = content;
    let apiEndpoint = '';
    let postData = {};
    let postMode = '';

    const validImageUrls = ImageUrls.filter(url => url.trim() !== '');
    if (TargetPageIds.length === 0) {
      setError('Vui lòng chọn ít nhất một Fanpage.');
      return; // Dừng lại, không reset form
    }
    
    if((ROOT_URL===undefined || ROOT_URL.trim().length===0) && req){
        apiEndpoint= req.headers.origin; //"http://localhost:3000";
    }
    else
    {
        apiEndpoint=ROOT_URL;   
    }
    let commentContent = '';
    if(Comment)
    {
        
        const commentsRes = await axios.get(`${apiEndpoint}/api/comment-manager?cid=${Comment}&&accessToken=${INTERNAL_SECRET}`);
        commentContent = commentsRes.data.comment ? commentsRes.data.comment.content :'';
    }
    if (VideoPath && VideoPath.trim().length > 0) {
        apiEndpoint = `${apiEndpoint}/api/post-video-to-facebook`;
        postMode = 'VIDEO/REELS';
        postData = {
            internalSecret: INTERNAL_SECRET,
            accessToken: accessToken,
            videoPath: VideoPath,
            caption: MainContent,
            selectedPageIds: TargetPageIds,
            commentContent: commentContent,
        };
    }else {
        apiEndpoint = `${apiEndpoint}/api/post-to-facebook-url`;
        postMode = 'IMAGE/ALBUM';
        postData = {
            internalSecret: INTERNAL_SECRET,
            accessToken: accessToken,
            caption: MainContent,
            imageUrls: validImageUrls.slice(0, 8),
            selectedPageIds: TargetPageIds,
            commentContent: commentContent,
        };
    }

    try {
      const response = await axios.post(apiEndpoint, postData);
      const successCount = response.data.results.filter(r => r.status === 'success').length;
      let fullMessage = `Đã đăng thành công ${successCount}/${postData.selectedPageIds.length} Fanpage.`;
      
      if (response.data.results) {
            const postedComments = response.data.results.filter(r => r.status === 'success');
            const countComment = Array.isArray(postedComments) ? postedComments[0].comments.length : postedComments.length;
            console.log("PostedComment=", postedComments);
            fullMessage += ` Và Comment đã thử đăng tổng cộng ${countComment}`;
      }
      console.log('-----Kết quả đăng bài::', fullMessage);
      
      const postedIds = response.data.results.map(r => r.postId.includes('_')?`${r.postId}`:`${r.pageId}_${r.postId}`).filter(id => id)
      return ({ 
            success: true, 
            postedIds: postedIds,
            message: fullMessage,
            details: response.data.results,

        });
    } 
    catch (error) {
        console.error(`Error during ${postMode} process:`, error.response ? error.response.data : error.message);
        return ({ 
            success: false, 
            postedIds: [],
            message: `Lỗi khi đăng bài loại ${postMode} lên Facebook.`, 
            details: error.response?.data?.error?.message || error.message 
        });
    } 
  };

// 3. HÀM XỬ LÝ LẬP LỊCH CHÍNH
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    const token = await getToken({ req, secret });
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated.' });
    }
    
    const currentUserId = token.sub; 
    let errorCount = 0; 

    const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowUTC0 = new Date(); //UTC+0
    const nowUTC7Time = nowUTC0.getTime() + UTC7_OFFSET_MS; 
    const nowUTC7 = new Date(nowUTC7Time);
    console.log(`[Scheduler] Bắt đầu quét lúc: UTC+0: ${nowUTC0.toISOString()}, UTC+7: ${nowUTC7.toISOString()}`);

    const startOfToday = new Date(nowUTC7);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    try {
        // B. TÌM CÁC BẢN GHI CẦN XỬ LÝ:
        // Điều kiện: ScheduleDate <= now (Đã đến giờ đăng)
        const postsToProcess = await prisma.content.findMany({
            where: {
                userId: currentUserId, // Lọc theo User ID
                ScheduleDate: {
                    lte: nowUTC7, 
                    gte: startOfToday, // Chỉ lấy bài từ đầu ngày hôm nay
                    lt: startOfTomorrow, // Đến trước đầu ngày mai
                    not: null,
                },
            },
        });
        //const pendingPosts = postsToProcess;
        const pendingPosts = postsToProcess.filter(content => 
             content.IDFbPost === null || content.IDFbPost === "" ||
             content.PostedIds.length < 1
        ); 

        if (pendingPosts.length === 0) {
            console.log('###[Scheduler] Không có bài viết nào cần xử lý lúc này.');
            return res.status(200).json({ success: true, count: 0, message: 'Không có bài viết nào cần xử lý lúc này.' });
        }
        console.log(`[Scheduler] Tìm thấy ${pendingPosts.length} bài viết cần xử lý.`);
        let successCount = 0
        let fullmessage = ''
        for (const content of pendingPosts) {    
            try {
                    console.log(`\n==[Scheduler] Posting Content-ID: [${content.id}] ${content.Name}==`);
                    const postResponse = await processPostFacebook(content, token.accessToken, req);
                    
                    //if (postResponse.success && postResponse.data?.id) 
                    if (postResponse.success && postResponse.postedIds.length > 0) {
                        const newFbPostId = postResponse.postedIds[0]; // Lấy ID của bài viết mới đăng
                        console.log(`------ Cập nhật DB với ID bài viết FB mới: ${postResponse.postedIds}.`);
                        await prisma.content.update({
                            where: { id: content.id },
                            data: {
                                IDFbPost: newFbPostId, // Cập nhật ID latest
                                PostedIds: postResponse.postedIds, // Cập nhật mảng PostedIds
                                PostedDate: new Date(), 
                            },
                        });
                        successCount++;
                        fullmessage += `${postResponse.message}; `
                    } 
                    console.log(`+++++Đã xong [${content.Name}]: ${postResponse.message}`)

                } catch (postError) {
                    console.error(`====== LỖI đăng bài [${content.id}]::`, postError.response?.data?.error?.message || postError.message);
                }
        }

        // E. TRẢ VỀ KẾT QUẢ CUỐI CÙNG
        return res.status(200).json({ 
            success: true, 
            count: successCount,
            error: errorCount,
            message: `Contents [${successCount} OK], [${errorCount} Failed] => ${fullmessage}`,
        });

    } catch (error) {
        // Xử lý lỗi hệ thống/Database
        console.error('[Scheduler] LỖI HỆ THỐNG:', error);
        return res.status(500).json({ 
            message: 'Lỗi server trong quá trình xử lý lập lịch.',
            details: error.message 
        });
    }
}