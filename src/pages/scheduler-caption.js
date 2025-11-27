// pages/index.js
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { useSession, signIn, signOut } from "next-auth/react";
import {FaSpinner, FaFileImage, FaListAlt, FaFacebook, FaCalendarAlt,  } from 'react-icons/fa';
import Header from '../components/Header'; 
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';


const API_COMMENT_MANAGER = '/api/comment-manager';
const API_PAGES_DB = '/api/pages-db';
// Tải Emoji Picker (Client-side only)
const Picker = dynamic(
  () => import('@emoji-mart/react').then((mod) => mod.default),
  { ssr: false }
);

// Danh sách icon phổ biến (Đã cập nhật: thu nhỏ và thêm các icon theo yêu cầu)
const commonIcons = [
  '👉','👍', '👎','👇', '☎️', '🔥', '💥', '✨', '🌟', '⚡', '🎉',
  '💖', '✅', '✔️', '❌', '➡️', '⬅️', '⬆️', '⬇️',
  '💰', '🎁', '📦', '🚚', '🛵', '🏠', '🛒','💯',, '🏆', '⏰', '⏱️', '📅',
  '📌', '📍', '💡', '🔔', '📣', '📢', '❓', '❗',
  '🟥', '🟨', '🟩', '🟦', '🟪', '⚪', '🟢','😀', '😂', '😍',
];
// Biến cho 8 URL ảnh
const initialImageUrlsState = Array(5).fill(''); 

export default function Home() {
  const { data: session } = useSession();

  const [isClient, setIsClient] = useState(false); 

  // STATES CHÍNH
  const [imageUrls, setImageUrls] = useState(initialImageUrlsState); 
  const [postContent, setPostContent] = useState('');
  const [facebookPages, setFacebookPages] = useState([]);
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [dbComments, setDbComments] = useState([]); // State lưu trữ các mẫu Comment từ DB
  const [selectedCommentId, setSelectedCommentId] = useState(''); // ID của mẫu Comment được chọn
  const [loadingPublish, setLoadingPublish] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [contentDrafts, setContentDrafts] = useState([]); 
  const [selectedDraftId, setSelectedDraftId] = useState(''); 
  const [loadingDrafts, setLoadingDrafts] = useState(false);
 
  const [postResults, setPostResults] = useState(null); // Lưu kết quả đăng FB
  const [scheduleDate, setScheduleDate] = useState(null); // Lưu trữ đối tượng Date (hoặc chuỗi ISO)
  const [isScheduled, setIsScheduled] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const contentRef = useRef(null);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchPagesAndComments = async () => {
        
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
            
        }
        
    };
  
  const fetchDrafts = async () => {
    setLoadingDrafts(true);
    try {
        const res = await axios.get('/api/content-manager?type=SCHEDULER');
        const allDrafts = res.data.contents.sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate));
        
        setContentDrafts(allDrafts.slice(0, 10)); 
    } catch (err) {
        console.error('Error fetching drafts:', err);
    } finally {
        setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    if (session) {
        fetchDrafts();
        fetchPagesAndComments();
    }
  }, [session]);

  // --- CÁC HÀM XỬ LÝ KHÁC ---
  const handleImageUrlsChange = (index, value) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  const handlePageCheckboxChange = (e) => {
    const { value, checked } = e.target;
    setSelectedPageIds(prev => 
        checked ? [...prev, value] : prev.filter(id => id !== value)
    );
  };

  const addEmoji = (emoji) => {
    if (!contentRef.current) return;
    
    const { selectionStart, selectionEnd } = contentRef.current;
    const emojiNative = typeof emoji === 'string' ? emoji : emoji.native; 
    
    const newContent = postContent.substring(0, selectionStart) + emojiNative + postContent.substring(selectionEnd);
    setPostContent(newContent);
    
    setTimeout(() => {
        const newCursorPos = selectionStart + emojiNative.length;
        contentRef.current.focus();
        contentRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // --- HÀM ĐĂNG BÀI (ĐÃ CẬP NHẬT) ---
  const handlePost = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setPostResults(null); // Reset kết quả đăng
    
    const validImageUrls = imageUrls.filter(url => url.trim() !== '');

    // CHECK LỖI TRƯỚC KHI GỬI (KHÔNG RESET Ở ĐÂY)
    if (selectedPageIds.length === 0) {
      setError('Vui lòng chọn ít nhất một Fanpage.');
      return; // Dừng lại, không reset form
    }
    if (validImageUrls.length === 0 && postContent.trim() === '') {
      setError('Vui lòng nhập nội dung bài viết HOẶC cung cấp ít nhất một URL hình ảnh.');
      return; // Dừng lại, không reset form
    }
    // Xác định nội dung Comment được chọn
    const selectedComment = dbComments.find(c => c.id === selectedCommentId);
    const commentContent = selectedComment ? selectedComment.content : '';
    const scheduleDateISO = isScheduled && scheduleDate ? scheduleDate.toISOString() : null;
    if(!scheduleDateISO)
    {
      setError('Vui lòng thời gian cần đăng lên lịch.');
      return;
    }
    setLoadingPublish(true);
    setIsPosting(true);
    let shouldResetForm = false; // Biến cờ
    const postData = {
        caption: postContent,
        imageUrls: imageUrls.slice(0, 5),
        selectedPageIds: selectedPageIds,
        commentContent: commentContent,
        scheduleDate: scheduleDateISO,
      };
    try {
      const response = await axios.post('/api/post-to-facebook-url', postData);
      const results = response.data.results.filter(r => r.status === 'success');
      
      if (results.length > 0) {
        let successMessage = `Lịch [${scheduleDate}] đã gửi thành công ${results.length}/${postData.selectedPageIds.length} Fanpages.`;
        console.log(successMessage);
        //const hasScheduledPost = results.some(r => r.postMode === 'SCHEDULED'); // return True/False
        const schedulePosts = results.filter(r => r.postMode === 'SCHEDULED');
        if (schedulePosts.length > 0) {
            let schedule_pageIds = []
            let postId = '';
             for(const scheduling of schedulePosts)
             {
                schedule_pageIds.push(scheduling.pageId);
                postId = scheduling.postId;
             }
             const res = await saveContent2Db(schedule_pageIds, postId, scheduleDate);
             if(res)
             {
              successMessage += ` Và lưu DB scheduler on ${res}`;
             }
             
        }
        else{
          successMessage += ' Và ' + results[0].message;
        }
        setMessage(successMessage);
        

      }
      else {
        shouldResetForm = false;
        setError('Có Fanpage đăng bài thất bại. Vui lòng kiểm tra lại');
      }
    } catch (err) {
      console.error('Lỗi khi gửi request:', err.response ? err.response.data : err.message);
      setError('Lỗi khi đăng bài: ' + (err.response?.data?.message || err.message));
    } finally {
      if (shouldResetForm) {
          setImageUrls(initialImageUrlsState);
          setPostContent('');
          setSelectedPageIds([]); 
      }
      setLoadingPublish(false);
      setIsPosting(false);
    }
  };

  const saveContent2Db = async (pageIds, postId, scheduleDate) => {
    if(pageIds.length < 1 || !postId || !scheduleDate)
      return null;
    const dataToSave = {
        Name: 'SCHEDULER-'+postContent.substring(0, 30) + '...', // Lấy 50 ký tự đầu làm tên
        MainContent: postContent.substring(0,100),
        ImageUrls: imageUrls.filter(url => url.trim() !== ''), // Chỉ lưu các URL hợp lệ
        Comment: 'SCHEDULER', 
        IDFbPost: postId, // Post ID
        PostedDate: scheduleDate,
        TargetPageIds: pageIds, 
        PostedIds: null,
    };
    try {
        // Gọi API để tạo Content mới trong MongoDB
        const saveRes = await axios.post('/api/content-manager', dataToSave); 
        console.log(saveRes);
        if(saveRes){
          return saveRes.data.content.id;
        }
    } catch (err) {
          console.error('Lỗi khi lưu ZyPost:', err.response?.data || err);
          setError('Lỗi khi lưu ZyPost: ' + (err.response?.data?.message || err.message));
          setMessage('');
      } 

    return null;
  }
  
  // --- RENDER GIAO DIỆN ---
  if (!isClient) {
    return (
        <div className="min-h-screen bg-gray-100">
          <Header onSignOut={() => signOut()} userName={session?.user?.name || 'User'} />
          <main className="py-4 px-4 max-w-7xl mx-auto"><p className="text-center py-10">Đang tải giao diện...</p></main>
        </div>
    );
  }
  
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-4">Vui lòng đăng nhập để sử dụng tính năng</h1>
          <button
            onClick={() => signIn('facebook')}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300"
          >
            Đăng nhập với Facebook
          </button>
        </div>
      </div>
    );
  }

  // Component Progress Overlay
  const ProgressOverlay = () => {
    return (
        // Lớp phủ (Backdrop)
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 transition-opacity"
            aria-modal="true"
            role="dialog"
        >
            {/* Khung nội dung (Spinner và thông báo) */}
            <div className="bg-white p-6 rounded-lg shadow-2xl flex flex-col items-center">
                <FaSpinner className="animate-spin text-indigo-600 h-10 w-10 mb-3" />
                <h2 className="text-xl font-semibold text-gray-800 mb-1">Đang xử lý đăng bài...</h2>
                <p className="text-sm text-gray-600">Vui lòng chờ trong giây lát, ứng dụng đang đăng bài viết lên {selectedPageIds.length} Fanpages.</p>
            </div>
        </div>
    );
  };
  const username = session?.user?.name || 'User';

  const validImageUrls = imageUrls.filter(url => url.trim() !== '');

  return (
    <div className="min-h-screen bg-gray-100">
      <Header onSignOut={() => signOut()} userName={username} />
      
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-2 bg-white p-3 rounded-lg shadow-lg flex flex-col max-h-[85vh]"> 
            <form onSubmit={handlePost} className="space-y-3"> 
              <div className='flex flex-col w-full px-3'>
                <div className="flex w-full justify-between items-center mb-4 pb-2 border-gray-200">
                    <h1 className="text-xl font-extrabold text-indigo-600">Đăng Bài Hẹn Ngày & Giờ</h1>
                    <button
                        type="submit"
                        disabled={loadingPublish || selectedPageIds.length === 0}
                        className={`py-2 px-4 rounded-md font-semibold text-white shadow-md transition duration-300 text-sm ${
                            loadingPublish || selectedPageIds.length === 0 
                            ? 'bg-indigo-300 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                        }`}
                    >
                        {loadingPublish ? 'Đang gửi yêu cầu đăng bài...' : `Đăng Bài viết lên ${selectedPageIds.length} Fanpages`}
                    </button>
                </div>
                <div>
                    {message ? 
                        <p className="p-2 rounded-md bg-green-100 text-green-700 border border-green-200 text-sm">{message}</p> 
                        : error ? 
                        <p className="p-2 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">{error}</p> 
                        : ''
                    }
                </div>
              </div>
              <div>
                  <textarea
                    ref={contentRef}
                    rows="10"
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Nhập nội dung bài viết..."
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm" 
                  />
                  <div className="flex justify-between items-center mt-1">
                      <div className="flex flex-wrap items-center gap-1"> 
                          {commonIcons.map((icon, index) => ( 
                              <span 
                                  key={index} 
                                  onClick={() => addEmoji(icon)}
                                  className=" text-sm cursor-pointer hover:bg-gray-200 rounded transition" // text-lg cho kích thước nhỏ hơn
                                  title={`Thêm ${icon}`}
                              >
                                  {icon}
                              </span>
                          ))}
                      </div>
                      <span className="text-xs text-gray-500">{postContent.length} ký tự</span>
                  </div>
              </div>
              <div > 
                  <p className="text-xs text-gray-500 mt-1">Dán URL ảnh công khai. Các URL rỗng sẽ bị bỏ qua khi đăng bài.</p>
                  {initialImageUrlsState.map((_, index) => (
                      <input
                          key={index}
                          type="url"
                          value={imageUrls[index] || ''}
                          onChange={(e) => handleImageUrlsChange(index, e.target.value)}
                          placeholder={`URL ảnh ${index + 1}`}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2 py-1 text-xs" 
                      />
                  ))}
              </div>
                
            </form>
            
          </div>
          <div className="lg:col-span-1 space-y-2 bg-white p-3 rounded-lg shadow-lg flex flex-col max-h-[85vh]">
            <div className="flex-none pb-2 mb-2 border-b border-gray-200">
                <p className="text-xs text-red-500 mb-2 font-semibold">Chọn ít nhất 1 Fanpage đăng bài</p> 
                {/* Chiều cao cố định và overflow-y-auto nếu cần thiết */}
                <div className="max-h-90 overflow-y-auto">
                    {facebookPages.length > 0 ? (
                        <ul className="divide-y divide-gray-100 text-xs space-y-0.5"> 
                        {facebookPages.map(page => (
                            <li key={page.id} className="flex items-center py-1"> 
                            <input
                                type="checkbox"
                                id={`page-${page.id}`}
                                value={page.id}
                                checked={selectedPageIds.includes(page.id)}
                                onChange={handlePageCheckboxChange}
                                className="h-3 w-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" 
                            />
                            
                            <label htmlFor={`page-${page.id}`} className="px-2 text-gray-900 font-medium cursor-pointer flex-grow hover:text-indigo-700 text-xs"> 
                                {page.name} <i>{page.id}</i>
                            </label>
                            </li>
                        ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-gray-500 italic py-2">Đang tải Fanpage của bạn...</p>
                    )}
                </div>
            </div>
            <div className="mb-4 bg-amber-300 px-2 py-2">
            <label className="flex items-center space-x-2 cursor-pointer mb-2">
                <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => {
                        setIsScheduled(e.target.checked);
                        // Reset lịch hẹn nếu bỏ chọn
                        if (!e.target.checked) {
                            setScheduleDate(null);
                        }
                    }}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center">
                    <FaCalendarAlt className="mr-1 text-indigo-600" /> Lên lịch đăng bài (Scheduled Post)
                </span>
            </label>

            {/* Hiển thị DatePicker nếu 'isScheduled' được chọn */}
            {isScheduled && (
                <div className="mt-2">
                    <DatePicker
                        selected={scheduleDate}
                        onChange={(date) => setScheduleDate(date)}
                        showTimeSelect
                        dateFormat="dd/MM/yyyy HH:mm" // Định dạng hiển thị
                        minDate={new Date()} // Không cho phép chọn ngày đã qua
                        placeholderText="Chọn Ngày và Giờ đăng bài"
                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {scheduleDate && (
                        <p className="text-xs text-indigo-600 italic mt-1">
                            Bài viết sẽ đăng vào: **{scheduleDate.toLocaleString('vi-VN')}**
                        </p>
                    )}
                </div>
            )}
        </div>

            {/* PHẦN DƯỚI: IMAGE PREVIEW (Chiếm hết không gian còn lại) */}
            <div className="flex-grow pt-2 overflow-y-auto">
                <h2 className="text-sm font-bold text-gray-900 mb-2 border-b pb-1">Preview Hình ảnh ({validImageUrls.length})</h2>
                {validImageUrls.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1.5">
                        {validImageUrls.map((url, index) => (
                            <div key={index} className="w-full h-20 overflow-hidden rounded-md border border-gray-300 flex items-center justify-center bg-gray-100">
                                <img 
                                    src={url} 
                                    alt={`Preview ${index + 1}`} 
                                    className="object-cover w-full h-full" 
                                    onError={(e) => { 
                                        e.target.onerror = null; 
                                        e.target.src="/placeholder-image.png"; 
                                        e.target.style.opacity = '0.5';
                                        e.target.title = "Lỗi tải ảnh";
                                    }} 
                                    title={`Ảnh ${index + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-500 italic text-center py-4">Chưa có URL ảnh nào để xem trước.</p>
                )}
            </div>
          
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <FaListAlt className="mr-2 text-indigo-600" /> Danh Sách Schedulers
            </h2>
          </div>
            {contentDrafts && contentDrafts.length > 0 ? (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {contentDrafts.map(content => {
                        const imageCount = content.ImageUrls?.filter(url => url.trim()).length || 0;
                        const postId = content.IDFbPost || 'N/A';
                        
                        return (
                            // <li className="p-2 rounded-md border cursor-pointer transition bg-gray-50 border-gray-200 hover:bg-gray-100">
                            <li key={content.id} className="p-2 border border-gray-200 rounded-lg shadow-sm bg-white hover:bg-gray-50 transition duration-150">
                              <div className="pr-4 overflow-hidden justify-betwee">
                                <div className="text-sm font-semibold text-gray-900 line-clamp-1">{content.Name}</div>
                                <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{content.MainContent.substring(0,100)}</p>
                                <div className="text-xs mt-1 justify-between  pt-1 border-t border-gray-200 text-gray-500">
                                  <span className="mt-1">Sent date: {content.PostedDate} || </span>
                                  <span className="mt-1">
                                    <FaFacebook className="inline mr-1 text-blue-500"/> ID: <span className="text-xs font-mono">{content.IDFbPost ? content.IDFbPost.substring(0, 25):''} ||</span>
                                  </span>
                                  <span className="mt-1">
                                    <FaFileImage className="inline mr-1 text-purple-500"/> {imageCount} ảnh
                                  </span>
                                </div>
                                <div className="text-xs mt-1 justify-between  pt-1 border-t border-gray-200 text-gray-500">
                                  <span className="mt-1">Pages: {content.TargetPageIds.join('; ')} </span>
                                </div>
                              </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="text-xs text-gray-500 italic text-center py-3">Không có bản scheduler nào.</p>
            )}
          
        </div>
      </main>
      {isPosting && <ProgressOverlay />}
    </div>
  );
}