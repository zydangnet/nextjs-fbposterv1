import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSession, signIn, signOut } from "next-auth/react";
import {FaComment, FaSpinner, FaListAlt, FaFacebook, FaCalendarAlt } from 'react-icons/fa';
import dynamic from 'next/dynamic';
import Header from '../components/Header'; 
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Tải Emoji Picker (Client-side only)
const Picker = dynamic(
  () => import('@emoji-mart/react').then((mod) => mod.default),
  { ssr: false }
);

export default function VideoUpload() {
  const { data: session } = useSession();
  
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [postContent, setPostContent] = useState('');
  const [loadingPublish, setLoadingPublish] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [facebookPages, setFacebookPages] = useState([]);
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [videoType, setVideoType] = useState('REELS'); // 'NORMAL' hoặc 'REELS'
  const [dbComments, setDbComments] = useState([]); // State lưu trữ các mẫu Comment từ DB
  const [selectedCommentId, setSelectedCommentId] = useState(''); // ID của mẫu Comment được chọn

  const [scheduleDate, setScheduleDate] = useState(null); // Lưu trữ đối tượng Date (hoặc chuỗi ISO)
  const [isScheduled, setIsScheduled] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Tải Fanpages
  useEffect(() => {
    const fetchPages = async () => {
      if (session) {
        try {
          const pagesRes = await axios.get('/api/get-facebook-pages');
          setFacebookPages(pagesRes.data.pages);
        } catch (err) {
          console.error('Error fetching FB-pages:', err);
          setError('Failed to load FB-pages: ' + (err.response?.data?.message || err.message));
        }
        try {
          const commentsRes = await axios.get('/api/comment-manager');
          setDbComments(commentsRes.data.comments);
        } catch (err) {
          console.error('Error fetching DB comments:', err);
        }
      }
    };
    fetchPages();
  }, [session]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedVideoFile(file);
      // Tạo URL để hiển thị preview
      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(file);
      }
    } else {
      setSelectedVideoFile(null);
      setError('Vui lòng chọn một file video hợp lệ.');
    }
  };

  const handlePageCheckboxChange = (e) => {
    const { value, checked } = e.target;
    setSelectedPageIds(prev => 
        checked ? [...prev, value] : prev.filter(id => id !== value)
    );
    
  };

  const handlePublishPost = async (event) => {
    event.preventDefault();

    const finalCaption = postContent.trim();
    
    if (!selectedVideoFile) {
        setError('Vui lòng tải lên một file video.');
        return;
    }
    if (selectedPageIds.length === 0) {
      setError('Vui lòng chọn ít nhất một Fanpage.');
      return; 
    }
    if (selectedPageIds.length > 6) {
      setError('Vui lòng chọn Fanpages <=6');
      return; 
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
    setIsPosting(true);
    setLoadingPublish(true);
    setMessage('');
    setError('');
    let fullMessage = String(selectedVideoFile.name);
    if(scheduleDate)
    {
      fullMessage += `**Lịch [${scheduleDate}] đã gửi `;
    }
    for (const pageId of selectedPageIds){
      try {
          // SỬ DỤNG FormData CHO VIDEO UPLOAD
          const formData = new FormData();
          formData.append('caption', finalCaption);
          formData.append('pageId', pageId); // Chỉ 1 page
          formData.append('videoType', videoType); // 'NORMAL' hoặc 'REELS'
          formData.append('video', selectedVideoFile, selectedVideoFile.name); // File video
          formData.append('commentContent', commentContent);
          formData.append('scheduleDate', scheduleDateISO);

          // GỌI API MỚI CHO VIDEO
          const response = await axios.post(`/api/post-fbvid-scheduler`, formData, {
              headers: {
                  'Content-Type': 'multipart/form-data', 
              },
              // Quan trọng: Tăng timeout/bỏ giới hạn cho file lớn
              timeout: 600000, // 10 phút
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
          });
          console.log(response);
          fullMessage += `<p>##PageID ${pageId}, đã gửi: bài viết ${JSON.stringify(response.data.results.id)}, và ${JSON.stringify(response.data.comments.length)} comments</p>`;
          
      } catch (err) {
        console.error('Lỗi khi gửi request đăng Video/Reels:', err.response ? err.response.data : err.message);
        fullMessage += 'Lỗi khi đăng Video/Reels: ' + (err.response?.data?.message || err.message);
      } 
    }
    setMessage(fullMessage);
    if (videoRef.current) {
      videoRef.current.src = '';
    }
    if (fileInputRef.current) { 
      fileInputRef.current.value = ''; 
    }
    setSelectedVideoFile(null);
    setSelectedCommentId('')
    setLoadingPublish(false);
    setIsPosting(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-4">Vui lòng đăng nhập</h1>
          <button
            onClick={() => signIn('facebook')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
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

  const isPostEmpty = !selectedVideoFile && postContent.trim() === '';
  const username = session?.user?.name || 'User';
  return (
    <div className="min-h-screen bg-gray-100 py-4 px-4">
      <Header onSignOut={() => signOut()} userName={username} /> 
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-200">
          <h1 className="text-xl font-extrabold text-indigo-600">Đăng Reels Hẹn Ngày & Giờ</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="border border-dashed border-gray-400 p-4 rounded-md bg-white">
                <label htmlFor="video-upload" className="block text-sm font-bold text-gray-800 mb-2">
                    Tải File Video (MP4, MOV...)
                </label>
                <input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-500 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />

                {selectedVideoFile && (
                    <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Preview:</p>
                        <video ref={videoRef} controls className="w-full h-auto max-h-64 object-contain rounded-lg border border-gray-300">
                            {/* Source sẽ được set trong handleFileSelect */}
                        </video>
                        <p className="text-xs text-gray-500 mt-1">File: {selectedVideoFile.name} ({(selectedVideoFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                    </div>
                )}
            </div>
            <div className="flex gap-4">
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            value="NORMAL"
                            checked={videoType === 'NORMAL'}
                            onChange={() => setVideoType('NORMAL')}
                            className="form-radio text-blue-600 h-4 w-4"
                        />
                        <span className="ml-2 text-gray-700">Video thường (Page Video)</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            value="REELS"
                            checked={videoType === 'REELS'}
                            onChange={() => setVideoType('REELS')}
                            className="form-radio text-green-600 h-4 w-4"
                        />
                        <span className="ml-2 text-gray-700">Reels (Video ngắn)</span>
                    </label>
            </div>
            <div>
                <textarea
                    id="postContent"
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    rows="6" 
                    placeholder="Nhập nội dung cho Video/Reels..."
                    className="mt-0.5 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
                ></textarea>
            </div>
            <div className="mb-4 bg-amber-200 px-2 py-2">
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
                      <FaCalendarAlt className="mr-1 text-indigo-600" /> Lên lịch đăng bài
                  </span>
              </label>
                {isScheduled && (
                  <div className="mt-1">
                      <DatePicker
                          selected={scheduleDate}
                          onChange={(date) => setScheduleDate(date)}
                          showTimeSelect
                          dateFormat="dd/MM/yyyy HH:mm" // Định dạng hiển thị
                          minDate={new Date()} // Không cho phép chọn ngày đã qua
                          placeholderText="Chọn Ngày và Giờ đăng bài"
                          className="w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      {scheduleDate && (
                          <p className="text-xs italic mt-1">
                              Bài viết sẽ đăng vào: **{scheduleDate.toLocaleString('vi-VN')}**
                          </p>
                      )}
                  </div>
                )}
              </div>
          </div>

          {/* Cột 2: Nội dung Post và Page Select */}
          <div className="space-y-4">
            <div className="max-h-90 overflow-y-auto">
              <label className="block text-sm font-medium text-red-700 mb-1">Chọn ít nhất 1 Fanpage để đăng</label>
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

            <button
                type="button"
                onClick={handlePublishPost}
                disabled={loadingPublish || isPostEmpty || selectedPageIds.length == 0}
                className={`w-full py-2 px-4 rounded-md font-semibold text-white shadow-md transition duration-300 mt-4 ${
                  loadingPublish || isPostEmpty || selectedPageIds.length == 0 ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }`}
            >
                {loadingPublish ? 'Đang tải lên và đăng...' : `Đăng ${videoType === 'REELS' ? 'Reels' : 'Video'}`}
            </button>
            
          </div>
        </div>

        {message && (
          <div className="mt-4 p-2 rounded-md bg-green-100 text-green-700 border border-green-200 text-sm" dangerouslySetInnerHTML={{ __html: message }}></div>
        )}
        {error && (
          <div className="mt-4 p-2 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">{error}</div>
        )}
      </div>
      {isPosting && <ProgressOverlay />}
    </div>
  );
}