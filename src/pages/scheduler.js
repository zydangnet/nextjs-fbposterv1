// pages/scheduler.js (Trang riêng cho Hệ thống Lên lịch)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useSession, signOut } from "next-auth/react";
import Header from '../components/Header';
import { GiConsoleController as SchedulerIcon } from 'react-icons/gi';
import { FaClock, FaCalendarAlt, FaSpinner, FaListAlt, FaFacebook } from 'react-icons/fa';

// Hook để chạy interval (Giữ lại logic cũ)
function useInterval(callback, delay) {
    const savedCallback = useRef();
  
    useEffect(() => {
      savedCallback.current = callback;
    }, [callback]);
  
    useEffect(() => {
      function tick() {
        savedCallback.current();
      }
      if (delay !== null) {
        let id = setInterval(tick, delay);
        return () => clearInterval(id);
      }
    }, [delay]);
}

export default function SchedulerPage() {
    const { data: session, status } = useSession();
    
    const [currentTimeUTC7, setCurrentTimeUTC7] = useState('');
    const [lastSchedulerRun, setLastSchedulerRun] = useState(null);
    const [schedulerStatus, setSchedulerStatus] = useState('');
    const [isSchedulerRunning, setIsSchedulerRunning] = useState(false);
    const [pendingPosts, setPendingPosts] = useState([]); 
    const [nextRunTime, setNextRunTime] = useState(null);
    
    // Hàm gọi API Lập lịch
    const runScheduler = useCallback(async () => {
        if (status !== 'authenticated') return;

        setIsSchedulerRunning(true);
        setSchedulerStatus('Đang gọi API xử lý đăng bài...');
        
        try {
            // Gọi API mới:
            const response = await axios.post('/api/scheduler/check-and-post');
            
            setSchedulerStatus(response.data.message || 'Xử lý hoàn tất.');
            setLastSchedulerRun(new Date());
            
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Lỗi kết nối hoặc server.';
            setSchedulerStatus(`Lỗi: ${errorMessage}`);
            console.error('Scheduler API Error:', error);
        } finally {
            setIsSchedulerRunning(false);
            // Sau khi chạy xong, thiết lập lại timer cho lần chạy tiếp theo
            setNextTimer();
            fetchPendingPosts();
        }
    }, [status]);
    const setNextTimer = useCallback(() => {
        const now = new Date();
        const nextHour = new Date(now);
        
        // Đặt giờ tròn tiếp theo (ví dụ: nếu 9:05, đặt 10:00)
        nextHour.setHours(now.getHours() + 1);
        nextHour.setMinutes(0);
        nextHour.setSeconds(0);
        nextHour.setMilliseconds(0);
        
        // Khoảng thời gian (ms) còn lại đến giờ tròn tiếp theo
        const delay = nextHour.getTime() - now.getTime();
        
        setNextRunTime(nextHour);

        // Xóa timer cũ nếu có
        const timerId = setTimeout(() => {
            runScheduler(); // Chạy scheduler khi đến giờ
        }, delay);

        return () => clearTimeout(timerId); // Trả về hàm cleanup
    }, [runScheduler]);
    // HÀM LẤY DANH SÁCH BÀI VIẾT ĐANG CHỜ
    const fetchPendingPosts = useCallback(async () => {
         if (status !== 'authenticated') {
             console.log('Skipping fetch: User is not authenticated.');
             return;
         }
         
         try {
             const response = await axios.get('/api/scheduler/pending-posts'); 
             const fetchedPosts = response.data.pendingPosts || [];
             console.log('Fetched pending posts:', response); 
             setPendingPosts(fetchedPosts);
         } catch (error) {
             // Lỗi phổ biến nhất là 401 Unauthorized.
             const errorMessage = error.response?.status === 401 
                 ? 'Lỗi 401: Chưa xác thực. Vui lòng đăng nhập lại.'
                 : (error.response?.data?.message || error.message || 'Lỗi mạng hoặc server.');
             console.error("Error fetching pending posts (Frontend):", errorMessage, error);
             // Cập nhật trạng thái để người dùng thấy lỗi
             setSchedulerStatus(`Lỗi tải nội dung: ${errorMessage}`);
             setPendingPosts([]);
         }
    }, [status]);
    
    // Effect chính: Khởi động timer và fetch data
    useEffect(() => {
        const timeInterval = setInterval(() => {
            setCurrentTimeUTC7(new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
        }, 1000);
        
        // Thiết lập timer cho lần chạy đầu tiên
        const cleanupTimer = setNextTimer();
        
        if (status === 'authenticated') {
            fetchPendingPosts();
        }
        // Fetch pending posts mỗi 500 giây
        const fetchInterval = setInterval(fetchPendingPosts, 500000);
        
        // Clean up
        return () => {
            clearInterval(timeInterval);
            clearInterval(fetchInterval);
            cleanupTimer(); // Hủy timeout
        };
    }, [status, setNextTimer, fetchPendingPosts]);

    if (status === 'loading') {
        return <div className="p-8 text-center text-gray-500 flex items-center justify-center"><FaSpinner className="animate-spin mr-2"/> Đang tải...</div>;
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-gray-100">
                <Header onSignOut={() => signOut()} userName="Guest" />
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <p className="text-center text-lg text-gray-500">Vui lòng <button onClick={() => signIn('facebook')} className="text-blue-600 font-medium underline">Đăng nhập</button> để truy cập.</p>
                </main>
            </div>
        );
    }
    
    const username = session?.user?.name || 'User';

    return (
        <div className="min-h-screen bg-gray-100">
            <Header onSignOut={() => signOut()} userName={username} /> 

            <main className="py-8 px-4">
                <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-xl">
                    <div className="flex items-center mb-6 border-b pb-3">
                        <SchedulerIcon className="mr-3 text-indigo-600" size={30} />
                        <h1 className="text-2xl font-extrabold text-gray-900">Hệ thống Lên lịch & Tự động Đăng (Scheduler)</h1>
                    </div>
                    <div className="space-y-4">
                        {/* 1. Đồng hồ UTC+7 */}
                        <div className="p-4 bg-indigo-100 border border-indigo-300 rounded-lg flex items-center justify-between">
                            <div className="flex items-center">
                                <FaClock className="text-indigo-700 mr-3" size={24} />
                                <span className="font-semibold text-indigo-900">Giờ Việt Nam (UTC+7):</span>
                            </div>
                            <span className="font-mono text-2xl text-gray-800">{currentTimeUTC7}</span>
                        </div>

                        <div className="mt-8 p-3 bg-white rounded-lg shadow border border-indigo-200">
                            <p className="text-sm text-gray-700">
                                **Thời điểm chạy tiếp theo:** <span className="text-indigo-600 font-medium">{nextRunTime ? nextRunTime.toLocaleString('vi-VN') : 'Đang tính...'}</span>
                            </p>
                        </div>
                        <p className="text-xs mb-4 p-3 bg-red-50 border border-red-200 rounded">
                            <span className='text-red-600 italic'>⚠️ **CẢNH BÁO:** Chức năng này chỉ chạy khi trang này được mở và hoạt động trên trình duyệt của bạn.</span>
                            <br/><span>[=Kết quả=] {schedulerStatus || 'Hệ thống đã sẵn sàng.'}</span>
                        </p>
                        
                    </div>
                </div>
                
                <div className="max-w-4xl mx-auto my-3 border border-gray-300 rounded-lg p-2 bg-gray-50"> {/* class="mt-8" */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center text-indigo-300">
                            <FaListAlt className="mr-2 text-indigo-300" /> Nội dung đang chờ
                        </h2>
                        <button
                                onClick={runScheduler} // Gọi hàm runScheduler đã tồn tại
                                disabled={isSchedulerRunning} // Tắt nút khi đang chạy
                                title="Chạy không cần đợi giờ tiếp theo"
                                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition duration-150 shadow-md
                                    ${isSchedulerRunning
                                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                        : 'bg-amber-600 text-white hover:bg-indigo-700'
                                    }`
                                }
                            >
                                {isSchedulerRunning ? (
                                    <FaSpinner className="animate-spin mr-2" />
                                ) : (
                                    <FaFacebook className="mr-2" />
                                )}
                                Đăng FB ngay
                        </button>
                    </div>
                     {pendingPosts.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2">
                            {pendingPosts.map((post) => (
                                <div key={post.id} className="p-2 border rounded-md bg-white shadow-sm hover:border-indigo-400 transition duration-150">
                                    <p className="text-sm font-semibold text-gray-800 truncate" title={post.Name}>
                                        {post.Name}
                                    </p>
                                    <p className="text-xs text-gray-600">ID: {post.id}</p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        <span className="font-medium">Giờ đăng:</span> <span className='text-amber-600 text-xs'><FaCalendarAlt className="inline-block mr-1" size={10} />{new Date(post.ScheduleDate).toLocaleString('vi-VN')}</span>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        <span className="font-medium">FanPages:</span> [{post.TargetPageIds.length}] {post.TargetPageIds.join(', ')}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        <span className="font-medium">Đã đăng:</span> {new Date(post.PostedDate).toLocaleString('vi-VN')}
                                    </p>
                                    
                                </div>
                            ))}
                         </div>
                     ) : (
                         <p className="text-sm text-gray-500 italic">Hiện không có bài viết nào đang chờ đăng</p>
                     )}
                </div>
            </main>
        </div>
    );
}