import { model, typed } from "axtore";
import { createHooks, useStable } from "axtore/react";
import { rest } from "axtore/rest";
import {
  FormEvent,
  PropsWithChildren,
  Suspense,
  useRef,
  useState,
} from "react";

export type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
};
export type Post = {
  id: number;
  userId: number;
  title: string;
  body: string;
};
export type Task = {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
};
export type Album = {
  id: number;
  userId: number;
  title: string;
};

// a base model contains custom context definition and common states or events
const baseModel = model({ context: { rest } })
  .event("login", typed<{ userId: number }>)
  .event("logout")
  .state("user", undefined as User | undefined);

// post model inherits from base model that means it can access all base model components
const postModel = baseModel
  .query("posts", ({ $user, rest }) => {
    const user = $user();
    if (!user) return [] as Post[];
    return rest<Post[]>("/posts", { params: { userId: user.id } });
  })
  .effect(({ $logout }) => {
    console.log("post module loaded");

    $logout.on(() => {
      console.log("cleanup post module");
    });
  });

const taskModel = baseModel
  .query("tasks", ({ $user, rest }) => {
    const user = $user();
    if (!user) return [] as Task[];
    return rest<Task[]>("/todos", { params: { userId: user.id } });
  })
  .effect(({ $logout }) => {
    console.log("task module loaded");

    $logout.on(() => {
      console.log("cleanup task module");
    });
  });

const albumModel = baseModel
  .query("albums", ({ $user, rest }) => {
    const user = $user();
    if (!user) return [] as Album[];
    return rest<Album[]>("/albums", { params: { userId: user.id } });
  })
  .effect(({ $logout }) => {
    console.log("album module loaded");

    $logout.on(() => {
      console.log("cleanup album module");
    });
  });

const appModel = baseModel.effect(
  async ({ $login, $logout, $user, rest, delay }) => {
    console.log("appModel loaded");

    // login and logout flow
    while (true) {
      const { userId } = await $login();

      const user = await rest<User>(`/users/${userId}`);

      await delay(500);

      // fetch user profile
      $user(user);

      await $logout();
      $user(undefined);
      console.log("user logged out");
    }
  }
);

const { useUser, useLogin, useLogout } = createHooks(appModel.meta);
const { useTasks, useInit: useInitTaskModule } = createHooks(taskModel.meta);
const { usePosts } = createHooks(postModel.meta);
const { useAlbums } = createHooks(albumModel.meta);

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const login = useLogin({
    onFire: () => {
      // when login event fired, just change UI to loading status
      setLoading(true);
    },
  });
  const inputRef = useRef<HTMLInputElement>(null);
  // use useStable hook to memorize callbacks without dependencies
  const { handleSubmit } = useStable({
    handleSubmit(e: FormEvent) {
      e.preventDefault();
      login.fire({ userId: parseInt(inputRef.current?.value ?? "", 10) });
    },
  });

  return (
    <fieldset disabled={loading}>
      <form onSubmit={handleSubmit} style={{ padding: 10 }}>
        <h2>Login</h2>
        <input
          type="text"
          ref={inputRef}
          placeholder="Enter user id (1 - 10)"
        />
        <div>{loading && "Processing..."}</div>
      </form>
    </fieldset>
  );
};

const Link = <T extends string>(
  props: PropsWithChildren<{
    type: T;
    currentType: T;
    onClick: (value: T) => void;
  }>
) => (
  <span
    onClick={() => props.onClick(props.type)}
    style={{ fontWeight: props.type === props.currentType ? "bold" : "normal" }}
  >
    {props.children}
  </span>
);

const DataViewer = (props: { data: any }) => {
  return <pre>{JSON.stringify(props.data, null, 2)}</pre>;
};

const ProfilePage = () => {
  const user = useUser();

  return (
    <>
      <h2>Profile</h2>
      <DataViewer data={user} />
    </>
  );
};

const PostsPage = () => {
  const posts = usePosts().wait();

  return (
    <>
      <h2>Posts</h2>
      <DataViewer data={posts} />
    </>
  );
};

const TasksPage = () => {
  const tasks = useTasks().wait();

  return (
    <>
      <h2>Tasks</h2>
      <DataViewer data={tasks} />
    </>
  );
};

const AlbumsPage = () => {
  const albums = useAlbums().wait();

  return (
    <>
      <h2>Albums</h2>
      <DataViewer data={albums} />
    </>
  );
};

const DashboardPage = () => {
  // sometimes we want to preload some specified modules
  useInitTaskModule();

  const logout = useLogout();
  const [page, setPage] = useState<"tasks" | "profile" | "albums" | "posts">(
    "profile"
  );
  return (
    <div style={{ padding: 10 }}>
      <p style={{ display: "flex", columnGap: 10, cursor: "pointer" }}>
        <Link type={"profile"} currentType={page} onClick={setPage}>
          Profile
        </Link>
        <Link type={"tasks"} currentType={page} onClick={setPage}>
          Tasks
        </Link>
        <Link type={"albums"} currentType={page} onClick={setPage}>
          Albums
        </Link>
        <Link type={"posts"} currentType={page} onClick={setPage}>
          Posts
        </Link>
        <span onClick={() => logout.fire()}>Logout</span>
      </p>
      <Suspense fallback="Loading...">
        {page === "profile" && <ProfilePage />}
        {page === "posts" && <PostsPage />}
        {page === "tasks" && <TasksPage />}
        {page === "albums" && <AlbumsPage />}
      </Suspense>
    </div>
  );
};

const App = () => {
  const user = useUser();
  return user ? <DashboardPage /> : <LoginPage />;
};

export { App };
