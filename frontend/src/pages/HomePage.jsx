import React from 'react'; import PostList from '../components/PostList'; import Sidebar from '../components/Sidebar'; import { useAuth } from '../context/AuthContext'; import CreatePost from '../components/CreatePost';
function HomePage(){const {user}=useAuth();const [postUpdateKey, setPostUpdateKey]=React.useState(0);return(<div className="flex flex-col lg:flex-row gap-8"><div className="flex-grow">{user&&<CreatePost onPostCreated={()=>setPostUpdateKey(k=>k+1)} />}<PostList key={postUpdateKey}/></div><Sidebar/></div>);}
export default HomePage;
