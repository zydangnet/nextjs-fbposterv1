// pages/zypostfb-manager.js (Quản lý Nội dung và Đăng bài Facebook)

import React, { useState, useEffect, useRef } from 'react'; 
import axios from 'axios';
import { useSession, signIn, signOut } from "next-auth/react";
import Header from '../components/Header'; 
import { FaPlus, FaTrash, FaEdit, FaTimes, FaSave, FaCheckCircle, FaFileVideo, FaClock, FaSpinner, FaCalendarAlt, FaFacebook, FaComment } from 'react-icons/fa';
import dynamic from 'next/dynamic'; 
import Link from 'next/link'; // Thêm Link nếu cần dùng

// Tải Emoji Picker (Client-side only)
const Picker = dynamic(
  () => import('@emoji-mart/react').then((mod) => mod.default),
  { ssr: false }
);

const commonIcons = [
  '👉','👍', '👎', '💪','👇', '📞', '☎️', '🔥', '💥', '✨', '🌟', '⚡', '🎉',
  '💖', '✅', '✔️', '❌', '➡️', '⬅️', '⬆️', '⬇️',
  '💰', '🎁', '📦', '🚚', '🛵', '🏠', '🏪', '🛒','💯',, '🏆', '⏰', '⏱️', '📅',
  '📌', '📍', '💡', '🔔', '📣', '📢', '❓', '❗',
  '🟥', '🟨', '🟩', '🟦', '🟪', '⚫', '⚪', '🟢','😀', '😂', '😍', '🙏',
];

const API_CONTENT_MANAGER = '/api/content-manager';
const API_PAGES_DB = '/api/pages-db';
const API_COMMENT_MANAGER = '/api/comment-manager';
const VIDEO_PATH_PREFIX = "G:\\My Drive\\FbVideoAff\\";//"D:\\google-drive\\FbVideoAff\\";//"D:\\AffVideos\\"; 

// Khởi tạo trạng thái nháp ban đầu
const initialDraftState = {
    Name: '',
    MainContent: '',
    VideoPath: '', 
    ImageUrls: ['', '', '', '', ''], 
    LinkAffi: '', 
    Comment: '',
    IDFbPost: [], 
    PostedDate: '', 
    ScheduleDate: '', 
    TargetPageIds: [], 
    PostedIds: [],
};

// Hàm chuyển đổi Date sang chuỗi datetime-local (YYYY-MM-DDTHH:mm)
const dateToDatetimeLocal = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day}T${h}:${min}`;
    } catch {
        return '';
    }
};


export default function ZyPostFbManager() { // ĐÃ ĐỔI TÊN COMPONENT
    const { data: session, status } = useSession();
    const [contents, setContents] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentDraft, setCurrentDraft] = useState(initialDraftState);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false); // STATE MỚI: Overlay/Spinner
    const [dbComments, setDbComments] = useState([]); // Mẫu Comment từ DB
    const [selectedCommentId, setSelectedCommentId] = useState(''); // ID của mẫu Comment được chọn
    const fileInputRef = useRef(null); 
    const contentRef = useRef(null); 
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    // THÊM STATE ĐỂ XỬ LÝ TRẠNG THÁI ĐĂNG BÀI
    const [postingState, setPostingState] = useState({}); // { [contentId]: { loading: bool, error: string, message: string } } 

    // STATES CHO FANPAGE (Tải từ Database)
    const [facebookPages, setFacebookPages] = useState([]);
    const [loadingPages, setLoadingPages] = useState(true);

    
    const fetchContents = async () => {
        setLoading(true);
        try {
            const res = await axios.get(API_CONTENT_MANAGER);
            console.log("Content:", res.data.contents);
            setContents(res.data.contents.sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate))); 
        } catch (err) {
            console.error('Error fetching contents:', err);
            setError('Lỗi khi tải danh sách nội dung.');
        } finally {
            setLoading(false);
        }
    };

    const fetchPagesAndComments = async () => {
        if (status !== 'authenticated') return;
        setLoadingPages(true);
        try{
            try {
            const pagesRes = await axios.get(API_PAGES_DB);
            setFacebookPages(pagesRes.data.pages);
            } catch (err) {
                console.error('Error fetching FB-pages:', err);
                throw err;
            }
            
            // Fetch Comments
            try {
                const commentsRes = await axios.get(API_COMMENT_MANAGER);
                setDbComments(commentsRes.data.comments);
            } catch (err) {
                console.error('Error fetching DB comments:', err);
                throw err;
            }
        }catch (err) {
            setError('Failed to load Database: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoadingPages(false);
        }
        
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchContents();
            fetchPagesAndComments();
        }
    }, [status]);

    const closeModal = () => {
        setIsModalOpen(false);
        setIsEditing(false);
        setCurrentDraft(initialDraftState);
        setMessage('');
        setError('');
        setShowEmojiPicker(false);
    };

    const openAddModal = () => {
        setCurrentDraft(initialDraftState);
        setIsEditing(false);
        setIsModalOpen(true);
        setMessage('');
        setError('');
        setShowEmojiPicker(false);
    };

    const openEditModal = (draft) => {
        const existingUrls = draft.ImageUrls || [];
        const paddedUrls = Array(5).fill('').map((_, i) => existingUrls[i] || '');
        
        const scheduledTime = dateToDatetimeLocal(draft.ScheduleDate);
        
        setCurrentDraft({ 
            ...draft,
            ImageUrls: paddedUrls, 
            IDFbPost: draft.IDFbPost || '',
            PostedDate: draft.PostedDate || '',
            ScheduleDate: scheduledTime, 
            TargetPageIds: draft.TargetPageIds || [],
            PostedIds: draft.PostedIds || [],
            Comment:draft.Comment || ''
        });
        setSelectedCommentId(draft.Comment);
        setIsEditing(true);
        setIsModalOpen(true);
        setMessage('');
        setError('');
        setShowEmojiPicker(false);
    };
    
    const handleImageUrlChange = (index, value) => {
        const newUrls = [...currentDraft.ImageUrls];
        newUrls[index] = value;
        setCurrentDraft({ ...currentDraft, ImageUrls: newUrls });
    };

    const addEmoji = (emoji) => {
        if (!contentRef.current) return;
        
        const { selectionStart, selectionEnd } = contentRef.current;
        const emojiNative = typeof emoji === 'string' ? emoji : emoji.native; 
        
        const newContent = currentDraft.MainContent.substring(0, selectionStart) + emojiNative + currentDraft.MainContent.substring(selectionEnd);
        setCurrentDraft(prev => ({ ...prev, MainContent: newContent }));
        
        setTimeout(() => {
            const newCursorPos = selectionStart + emojiNative.length;
            contentRef.current.focus();
            contentRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleVideoFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const fileName = file.name;
            const newVideoPath = VIDEO_PATH_PREFIX + fileName; 

            setCurrentDraft(prev => ({ 
                ...prev, 
                VideoPath: newVideoPath,
            }));

            setMessage(`Đã chọn file: "${fileName}". Đường dẫn đã được cập nhật thành: ${newVideoPath}`);
        }
        e.target.value = null; 
    };

    const handlePageIdsChange = (e) => {
        const { value, checked } = e.target;
        setCurrentDraft(prev => {
            const currentIds = prev.TargetPageIds || [];
            if (checked) {
                return { ...prev, TargetPageIds: [...currentIds, value] };
            } else {
                return { ...prev, TargetPageIds: currentIds.filter(id => id !== value) };
            }
        });
    };
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };
    const handleSave = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        
        if (status !== 'authenticated') {
            alert('Bạn chưa đăng nhập hoặc phiên đã hết hạn.');
            return;
        }
        //const selectedComment = dbComments.find(c => c.id === selectedCommentId); //From ComboBox
        
        const apiEndpoint = API_CONTENT_MANAGER;
        const validImageUrls = currentDraft.ImageUrls.filter(url => url.trim() !== '');

        const payload = {
            ...currentDraft,
            ImageUrls: validImageUrls, 
            ScheduleDate: currentDraft.ScheduleDate ? new Date(currentDraft.ScheduleDate) : null,
            TargetPageIds: currentDraft.TargetPageIds,
            VideoPath: currentDraft.VideoPath || null,
            IDFbPost: currentDraft.IDFbPost || null,
            Comment: selectedCommentId || null,
        };
        // BẬT TRẠNG THÁI ĐANG LƯU
        setIsSaving(true);
        try {
            if (isEditing) {
                await axios.put(apiEndpoint, payload);
                alert('Cập nhật nội dung thành công.');
            } else {
                await axios.post(apiEndpoint, payload);
                alert('Thêm nội dung mới thành công.');
            }
            fetchContents();
            closeModal();
        } catch (err) {
            console.error('Lỗi khi lưu:', err.response?.data || err.message);
            setError('Lỗi khi lưu nội dung: ' + (err.response?.data?.message || 'Không xác định'));
        }
         finally {
            // TẮT TRẠNG THÁI ĐANG LƯU
            setIsSaving(false); 
        }
    };
    
    // BỔ SUNG CHỨC NĂNG ĐĂNG BÀI LÊN FACEBOOK
    const handlePostToFacebook = async (content) => {
        // Xóa thông báo toàn trang
        setMessage('');
        setError('');
        
        // 1. Kiểm tra TargetPageIds
        const targetPageIds = content.TargetPageIds || [];
        if (targetPageIds.length === 0) {
            const errMessage = `LỖI ĐĂNG: Nội dung "${content.Name}" không có TargetPageIds. Vui lòng Sửa để thêm Pages.`;
            setError(errMessage);
            setPostingState(prev => ({ 
                ...prev, 
                [content.id]: { 
                    loading: false, 
                    error: errMessage, 
                    message: '' 
                } 
            }));
            return;
        }

        // 2. Bắt đầu đăng và cập nhật trạng thái loading
        setPostingState(prev => ({ ...prev, [content.id]: { loading: true, error: '', message: '' } }));

        try {
            // Chuẩn bị payload: Gửi toàn bộ draft data
            const payload = {
                id: content.id,
                Name: content.Name,
                MainContent: content.MainContent,
                VideoPath: content.VideoPath,
                ImageUrls: (content.ImageUrls || []).filter(url => url.trim() !== ''),
                LinkAffi: content.LinkAffi,
                Comment: content.Comment,
                TargetPageIds: targetPageIds, // Chỉ gửi các page đã chọn
            };

            // Gọi API Đăng bài (API này cần được tạo mới)
            const res = await axios.post('/api/post-content-to-facebook', payload);

            // 3. Xử lý kết quả
            const failedCount = res.data.results.filter(r => r.status === 'failed').length;
            
            // Cập nhật lại danh sách nội dung để lấy IDFbPost, PostedDate mới (nếu API trả về)
            fetchContents(); 
            
            let successMessage = '';
            if (failedCount === 0) {
                successMessage = `Đăng thành công lên ${res.data.results.length} Page!`;
            } else {
                const successCount = res.data.results.length - failedCount;
                successMessage = `Đã đăng thành công lên ${successCount} Page. ${failedCount} Page thất bại.`;
            }
            
            setPostingState(prev => ({ 
                ...prev, 
                [content.id]: { 
                    loading: false, 
                    error: failedCount > 0 ? 'Có lỗi xảy ra trên một số Page.' : '',
                    message: successMessage,
                } 
            }));


        } catch (err) {
            console.error('Lỗi khi Đăng bài Facebook:', err.response?.data || err.message);
            const apiError = err.response?.data?.message || 'Lỗi không xác định khi gọi API đăng bài.';
            
            // Hiển thị lỗi lớn ở đầu trang
            setError(`Lỗi Đăng bài cho "${content.Name}": ${apiError}`);
            
            // Cập nhật lỗi cho từng record
            setPostingState(prev => ({ 
                ...prev, 
                [content.id]: { 
                    loading: false, 
                    error: apiError,
                    message: ''
                } 
            }));
        }
    };
    // KẾT THÚC CHỨC NĂNG BỔ SUNG

    const handleDelete = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa bản nháp này?')) return;
        setMessage('');
        setError('');
        try {
            await axios.delete('/api/content-manager', { data: { id } });
            setMessage('Xóa nội dung thành công.');
            fetchContents();
        } catch (err) {
            console.error('Lỗi khi xóa:', err.response?.data || err.message);
            setError('Lỗi khi xóa nội dung: ' + (err.response?.data?.message || 'Không xác định'));
        }
    };

    if (status === 'loading') {
        return <div className="p-8 text-center text-gray-500 flex items-center justify-center"><FaSpinner className="animate-spin mr-2"/> Đang tải...</div>;
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-gray-100">
                <Header onSignOut={() => signOut()} userName="Guest" />
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0">
                        <p className="text-center text-lg text-gray-500">Vui lòng <button onClick={() => signIn('facebook')} className="text-blue-600 font-medium underline">Đăng nhập bằng Facebook</button> để sử dụng chức năng này.</p>
                    </div>
                </main>
            </div>
        );
    }

    const username = session?.user?.name || 'User';

    return (
        <div className="min-h-screen bg-gray-100">
            <Header onSignOut={() => signOut()} userName={username} /> 
            {/* <main className="py-2 px-1"> */}
            <main className="container mx-auto p-4">
                <div className="max-w-6xl mx-auto bg-white p-1 rounded-lg shadow-xl">
                    <div className="flex px-3 py-1 justify-between items-center mb-3 border-b pb-1">
                        {/* CẬP NHẬT TIÊU ĐỀ H1 */}
                        <h1 className="text-2xl font-extrabold text-gray-900">Quản lý [Nội dung đăng Fanpages]</h1> 
                        <button
                            onClick={openAddModal}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition"
                        >
                            <FaPlus className="mr-2" /> Thêm mới
                        </button>
                        {/* <div className="bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center text-sm">
                            <Link href="/scheduler" className="px-2 py-2 text-violet-400 font-semibold hover:text-violet-900"><FaClock className="inline-block mr-2"/>Truy cập Scheduler</Link>
                        </div>  */}
                    </div>
                    {message && !isModalOpen && ( 
                        <p className="p-2 mb-2 rounded-md bg-green-100 text-green-700 border border-green-200 text-sm">{message}</p>
                    )}
                    {error && !isModalOpen && (
                        <p className="p-2 mb-2 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm font-medium">{error}</p>
                    )}

                    {/* BẢNG DỮ LIỆU */}
                    {loading ? (
                        <p className="text-center py-10 text-gray-500 flex items-center justify-center"><FaSpinner className="animate-spin mr-2"/> Đang tải dữ liệu...</p>
                    ) : contents.length === 0 ? (
                        <p className="text-center py-10 text-gray-500">Chưa có bản nháp nội dung nào được lưu.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên/ID</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Media</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nội dung chính</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày đăng</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {contents.map((content) => (
                                        <tr key={content.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-1 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{content.Name}</div>
                                                <div className="text-xs text-gray-500">{content.id}</div>
                                                <div className="text-xs text-gray-500">Comment-ID:({content.Comment?content.Comment.substring(0, 30).replace(/\n/g, ' '):'...'})</div>
                                            </td>
                                            <td className="px-3 py-1">
                                                {content.ScheduleDate ? (
                                                    <p className={`text-xs font-semibold ${new Date(content.ScheduleDate) < new Date() && !content.IDFbPost ? 'text-red-600' : 'text-purple-600'}`}>
                                                        <FaCalendarAlt className="mr-1 inline-block"/> Lịch: {new Date(content.ScheduleDate).toLocaleString('vi-VN')}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic">Không có lịch</p>
                                                )}
                                                <p className="text-xs text-gray-600 font-mono flex items-center mt-1"><FaFileVideo className="mr-1 text-blue-500"/> Video: {content.VideoPath ? 'Có' : 'N/A'}</p>
                                                <p className="text-xs text-purple-600 font-mono mt-1 flex items-center"><FaFacebook className="mr-1"/> Pages: {content.TargetPageIds?.length || 0}</p>
                                            </td>
                                            <td className="px-3 py-2 max-w-sm">
                                                <p className="text-sm text-gray-500 line-clamp-3">{content.MainContent}</p>
                                            </td>
                                            <td className="px-3 py-1 whitespace-nowrap" title={new Date(content.PostedDate).toLocaleString("vi-VN")}>
                                                {content.IDFbPost && content.Comment != "SCHEDULER" ? (
                                                    <div className='text-xs font-mono'>
                                                        <a 
                                                        href={`https://facebook.com/${content.IDFbPost.split('_')[0]}/posts/${content.IDFbPost.split('_')[1]}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-blue-500 hover:text-blue-800 underline"
                                                        title={content.PostedIds.join(', ')}
                                                    >
                                                        <FaCheckCircle className="inline-block mr-1 text-green-500"/> Đã đăng 
                                                    </a><p>{new Date(content.PostedDate).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p></div>
                                                ) : (
                                                    <div className='text-xs font-mono'><span className="text-xs text-red-500 font-medium">Chưa đăng</span>
                                                    <p>{new Date(content.PostedDate).toLocaleString('vi-VN')}</p></div>
                                                ) }
                                                
                                            </td>
                                            <td className="whitespace-nowrap text-center text-sm font-medium bg-gray-100">
                                                {/* CHỨC NĂNG ĐĂNG BÀI BỔ SUNG */}
                                                {postingState[content.id]?.loading ? (
                                                    <span className="text-blue-500 mr-3 inline-flex items-center" title="Đang gọi API đăng bài...">
                                                        <FaSpinner className="animate-spin mr-1" /> Đang đăng...
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePostToFacebook(content)}
                                                        disabled={content.TargetPageIds?.length === 0}
                                                        className={`text-blue-400 hover:text-blue-800 mr-3 transition ${content.TargetPageIds?.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        title={content.TargetPageIds?.length === 0 ? "Lỗi: TargetPageIds trống" : "Đăng nội dung lên Facebook ngay"}
                                                    >
                                                        <FaFacebook className="inline-block mr-1" /> Đăng FB
                                                    </button>
                                                )}
                                                
                                                {/* Hiển thị lỗi đăng bài nếu có */}
                                                {postingState[content.id]?.error && (
                                                    <p className="text-xs text-red-500 mt-1 line-clamp-1" title={postingState[content.id].error}>
                                                        Lỗi: {postingState[content.id].error.substring(0, 30) + (postingState[content.id].error.length > 30 ? '...' : '')}
                                                    </p>
                                                )}
                                                {/* Hiển thị thông báo thành công */}
                                                {postingState[content.id]?.message && (
                                                    <p className="text-xs text-green-600 mt-1 line-clamp-1" title={postingState[content.id].message}>
                                                        {postingState[content.id].message}
                                                    </p>
                                                )}
                                                {/* KẾT THÚC CHỨC NĂNG BỔ SUNG */}
                                                <div className='py-3 px-2'><button
                                                    onClick={() => openEditModal(content)}
                                                    className="text-amber-500 hover:text-amber-800 mr-3"
                                                    title="Sửa bản nháp"
                                                >
                                                    <FaEdit className="inline-block" /> Sửa
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(content.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Xóa bản nháp"
                                                >
                                                    <FaTrash className="inline-block" /> Xóa
                                                </button></div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* MODAL (Giữ nguyên UI) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-5 mx-auto p-2 border w-5/6 md:w-3/4 lg:w-2/3 xl:w-2/3 shadow-lg rounded-md bg-white">
                        <div className="flex justify-between items-center pb-1 border-b">
                            <h3 className="font-bold text-gray-900">{isEditing ? 'Sửa Nội dung Bài viết' : 'Thêm Nội dung Bài viết Mới'}</h3>
                            <button onClick={closeModal} className="text-gray-500 hover:text-gray-800">
                                <FaTimes size={20} />
                            </button>
                        </div>

                        {/* MESSAGE/ERROR TRONG MODAL */}
                        {message && <p className="mt-4 p-2 rounded-md bg-green-100 text-green-700 border border-green-200 text-sm">{message}</p>}
                        {error && <p className="mt-4 p-2 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">{error}</p>}
                        
                        <form onSubmit={handleSave} className="mt-4 space-y-4">
                            {/* Cột chính */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Cột Trái: Nội dung chính */}
                                <div className="md:col-span-2 space-y-4">
                                    <div className="relative">
                                        <label htmlFor="Name" className="block text-sm font-medium text-gray-700">Tên Bản Nháp</label>
                                        <div className="mt-1 flex">
                                            <input
                                            type="text" placeholder="Tên Bản Nháp"
                                            id="Name"
                                            value={currentDraft.Name}
                                            onChange={(e) => setCurrentDraft({ ...currentDraft, Name: e.target.value })}
                                            className="mt-1 w-2/3 border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                            required
                                        />
                                        <input
                                            type="text"
                                            id="Name" placeholder="ID Bài viết" 
                                            value={currentDraft.IDFbPost}
                                            onChange={(e) => setCurrentDraft({ ...currentDraft, IDFbPost: e.target.value })}
                                            className="mx-5 w-1/3 border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                        />
                                        </div>
                                    </div>
                                    {/* MainContent field */}
                                                                        <div>
                                                                            <label className="block text-sm font-medium text-gray-700">Nội dung Chính (MainContent)*</label>
                                                                            <textarea
                                                                                ref={contentRef} 
                                                                                rows="8"
                                                                                value={currentDraft.MainContent}
                                                                                onChange={(e) => setCurrentDraft({ ...currentDraft, MainContent: e.target.value })}
                                                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                                                required
                                                                            />
                                                                            
                                                                            {/* Emotions Bar và Picker */}
                                                                            <div className="flex justify-between items-center mt-1">
                                                                                <div className="flex flex-wrap items-center gap-1">
                                                                                    {commonIcons.map((icon, index) => (
                                                                                        <span 
                                                                                            key={index} 
                                                                                            onClick={() => addEmoji(icon)}
                                                                                            className="cursor-pointer hover:bg-gray-200 rounded transition"
                                                                                            title={`Thêm ${icon}`}
                                                                                        >
                                                                                            {icon}
                                                                                        </span>
                                                                                    ))}
                                                                                    
                                                                                </div>
                                                                                <span className="text-xs text-gray-500">{currentDraft.MainContent.length} ký tự</span>
                                                                            </div>
                                                                        </div>

                                    {/* Video Path (Chỉ hiển thị đường dẫn) */}
                                    <div className="space-y-2">
                                        <label htmlFor="VideoPath" className="block text-sm font-medium text-gray-700 flex items-center">
                                            <FaFileVideo className="mr-1 text-blue-600"/> Đường dẫn Video (Local)
                                        </label>
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                id="VideoPath"
                                                value={currentDraft.VideoPath}
                                                onChange={(e) => setCurrentDraft({ ...currentDraft, VideoPath: e.target.value })}
                                                className="flex-grow border border-gray-300 rounded-md shadow-sm p-1 text-sm font-mono"
                                                placeholder={VIDEO_PATH_PREFIX + "ten-file.mp4"}
                                            />
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleVideoFileSelect}
                                                accept="video/*"
                                                style={{ display: 'none' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current.click()}
                                                className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition"
                                            >
                                                Chọn File
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="SelectedCommentId" className="block text-sm font-medium text-gray-700 flex items-center">
                                            <FaComment className="mr-1 text-gray-500" /> Chọn Comment 
                                        </label>
                                        {dbComments.length > 0 ? (
                                            <select
                                                id="SelectedCommentId"
                                                name="SelectedCommentId"
                                                value={selectedCommentId}
                                                onChange={(e) => setSelectedCommentId(e.target.value)}
                                                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            >
                                                <option value="">-- Không sử dụng Comment --</option>
                                                {dbComments.map(comment => (
                                                    <option key={comment.id} value={comment.id}>
                                                        {comment.name} ({comment.content.substring(0, 30).replace(/\n/g, ' ')}...)
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">Đang tải mẫu Comment hoặc chưa có mẫu nào.</p>
                                        )}
                                        <p className="text-xs text-gray-500 italic mt-2">Nội dung comment sẽ được split theo dòng và shuffle.</p>
                                        <Link href="/manage-comment" legacyBehavior><a className="text-indigo-600 text-xs hover:underline">Quản lý mẫu Comment tại đây</a></Link>
                                    </div>
                                    <div className='text-xs'>Danh sách ID Posted: {currentDraft.PostedIds.join(", ")}</div>
                                </div>
                                
                                {/* Cột Phải: Ảnh, Lịch, Page */}
                                <div className="md:col-span-1 space-y-2">
                                    {/* URLs Hình ảnh */}
                                    <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                                        {currentDraft.ImageUrls.map((url, index) => (
                                            <div key={index} className="flex items-center mt-1 space-x-2">
                                                <input
                                                    type="url"
                                                    value={url}
                                                    onChange={(e) => handleImageUrlChange(index, e.target.value)}
                                                    placeholder={`URL ảnh ${index + 1}`}
                                                    className="block w-full border border-gray-300 rounded-md shadow-sm p-1 text-xs"
                                                />
                                                {/* Preview Hình ảnh */}
                                                <div className="w-6 h-6 flex-none overflow-hidden rounded border border-gray-300 bg-gray-100">
                                                    {url ? (
                                                        <img
                                                            src={url}
                                                            alt={`Preview ${index + 1}`}
                                                            className="object-cover w-full h-full"
                                                            onError={(e) => { 
                                                                e.target.onerror = null; 
                                                                e.target.src="/placeholder-image.png"; 
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full text-gray-400 text-xs flex items-center justify-center">URL</div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                        ))}
                                    </div>
                                    {/* Lịch đăng */}
                                    <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                                        <label htmlFor="ScheduleDate" className="block text-sm font-bold text-gray-700 flex items-center">
                                            <FaClock className="mr-1 text-purple-600"/> Lịch đăng như CronJob
                                        </label>
                                        <input
                                            type="datetime-local"
                                            id="ScheduleDate"
                                            value={currentDraft.ScheduleDate}
                                            onChange={(e) => setCurrentDraft({ ...currentDraft, ScheduleDate: e.target.value })}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                        />
                                        <p className="text-xs text-gray-500 italic">Đặt lịch để Scheduler tự động đăng.</p>
                                    </div>

                                    {/* Fanpage Targets */}
                                    <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                                        <label className="block text-sm font-bold text-gray-700 flex items-center mb-2">
                                            <FaFacebook className="mr-1 text-blue-600"/> Fanpage Target (TargetPageIds)
                                        </label>
                                        <div className="max-h-90 overflow-y-auto pr-2">
                                            {loadingPages ? (
                                                <p className="text-xs text-gray-500 italic flex items-center"><FaSpinner className="animate-spin mr-1"/> Đang tải pages...</p>
                                            ) : facebookPages.length > 0 ? (
                                                <ul className="space-y-1">
                                                    {facebookPages.map((page) => (
                                                        <li key={page.id} className="flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                id={`page-${page.id}`}
                                                                value={page.id}
                                                                checked={currentDraft.TargetPageIds.includes(page.id)}
                                                                onChange={handlePageIdsChange}
                                                                className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <label htmlFor={`page-${page.id}`} className="ml-2 text-xs text-gray-700 cursor-pointer">
                                                                {page.name} #{page.id}
                                                            </label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-red-500">Không tìm thấy Fanpage nào.</p>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 italic mt-2">Chọn Page muốn đăng/lên lịch.</p>
                                    </div>
                                    
                                </div>
                            </div>
                            
                            {/* NÚT LƯU */}
                            <div className="flex justify-end space-x-1 pt-2 border-t">
                                <button 
                                    type="button" 
                                    onClick={closeModal} 
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition"
                                    disabled={isSaving}
                                >
                                    <FaTimes className="inline-block mr-1"/> Hủy
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition"
                                    disabled={isSaving}
                                >
                                    <FaSave className="inline-block mr-1"/> {isEditing ? 'Lưu Thay Đổi' : 'Thêm Mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
