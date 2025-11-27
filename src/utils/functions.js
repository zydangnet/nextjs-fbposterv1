// utils/functions.js
export const addPostedIdToContent = async (contentId, postedId) => {
    // Thêm một ID mới vào mảng PostedIds
    await prisma.content.update({
        where: { id: contentId },
        data: {
            PostedIds: {
                push: postedId, // Dùng 'push' cho mảng trong MongoDB/Prisma
            },
        },
    });
};
/**
 * Cập nhật thông tin bài viết Facebook đã đăng thành công vào Content Draft.
 * @param {string} id - ID của bản ghi Content (từ MongoDB).
 * @param {string} pageId - ID của Fanpage đã đăng bài.
 * @param {string} fullPostId - Post ID đầy đủ trả về từ Facebook (ví dụ: 'page_id_post_id').
 */
export const updateDraftPostInfo = async (id, pageId, fullPostId) => {
    // Facebook Post ID có thể là {Post_ID} hoặc {Page_ID}_{Post_ID}
    // Dù thế nào, ta dùng fullPostId trực tiếp và chỉ cần pageId để log
    
    // Tách Post ID thuần túy (nếu cần) hoặc chỉ dùng fullPostId
    // const now = new Date(); // Có thể dùng trực tiếp trong data

    try {
        await prisma.content.update({
            where: { id: id },
            data: {
                // Thêm ID bài viết mới vào mảng PostedIds (sử dụng push)
                PostedIds: {
                    push: fullPostId,
                },
                IDFbPost: fullPostId, 
                PostedDate: new Date(), 
            },
        });
        console.log(`[PRISMA UTIL] Content ID ${id} updated for Page ${pageId} with Post ID ${fullPostId}`);
    } catch (error) {
        console.error(`[PRISMA ERROR] Failed to update Content ID ${id} with Post ID ${fullPostId}:`, error.message);
        // Có thể throw lỗi hoặc log, tùy theo cách bạn muốn xử lý lỗi đăng bài.
    }
};

/**
 * Lấy Page Access Token từ DB
 * @param {string} pageId - ID của Fanpage.
 * @returns {string} Page Access Token
 */
export const getPageAccessToken = async (pageId) => {
    try {
        const page = await prisma.FacebookPage.findUnique({
            where: { pageId: pageId },
            select: { accessToken: true }
        });

        if (!page || !page.accessToken) {
            throw new Error(`Không tìm thấy Page Access Token cho Page ID: ${pageId} trong DB.`);
        }
        return page.accessToken;
    } catch (error) {
        console.error(`[PRISMA ERROR] Lỗi khi lấy Page Access Token cho ${pageId}:`, error.message);
        throw error;
    }
};
/**
 * Tách một chuỗi (thường là nội dung comment) thành mảng các chuỗi con, 
 * loại bỏ khoảng trắng và các dòng trống.
 * @param {string} rawString - Chuỗi đầu vào chứa các dòng comment.
 * @returns {Array<string>} Mảng các comment đã được làm sạch.
 */
export function splitAndCleanString(rawString) {
    if (!rawString) {
        return [];
    }
    return rawString
        .split('\n') // Tách chuỗi thành mảng dựa trên ký tự xuống dòng
        .map(c => c.trim()) // Loại bỏ khoảng trắng ở đầu và cuối mỗi dòng
        .filter(c => c !== ''); // Loại bỏ các dòng trống hoàn toàn
}
/**
 * Hoán đổi vị trí ngẫu nhiên các phần tử trong một mảng (Fisher-Yates Shuffle).
 * @param {Array<any>} array - Mảng cần shuffle.
 * @returns {Array<any>} Mảng đã được shuffle.
 */
export function shuffleArray(array) {
    // Tạo bản sao để tránh thay đổi mảng gốc (immutable)
    const shuffledArray = [...array]; 
    for (let i = shuffledArray.length - 1; i > 0; i--) {
        // Chọn ngẫu nhiên một index từ 0 đến i
        const j = Math.floor(Math.random() * (i + 1));
        // Hoán đổi vị trí: shuffledArray[i] và shuffledArray[j]
        [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }
    return shuffledArray;
}