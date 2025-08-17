import React from 'react';
const PostSkeleton = () => (
    <div className="bg-gray-800 rounded-lg shadow-lg flex p-4 animate-pulse">
      <div className="flex flex-col items-center mr-4">
        <div className="h-6 w-4 bg-gray-700 rounded"></div>
        <div className="h-6 w-8 bg-gray-700 rounded my-2"></div>
        <div className="h-6 w-4 bg-gray-700 rounded"></div>
      </div>
      <div className="flex-grow">
        <div className="h-4 w-3/4 bg-gray-700 rounded mb-2"></div>
        <div className="h-6 w-1/2 bg-gray-700 rounded"></div>
      </div>
    </div>
);
export default PostSkeleton;
