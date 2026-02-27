/**
 * Keyboard Context - 全局键盘事件管理
 *
 * 这个模块提供了一种统一的机制来管理终端键盘事件。
 * 采用发布-订阅模式，多个组件可以同时订阅键盘事件，而无需重复监听终端输入。
 *
 * 主要功能：
 * - 统一管理终端原始输入模式 (raw mode)
 * - 解析终端原始按键为结构化 Key 对象
 * - 通过 React Context 提供订阅/取消订阅接口
 * - 支持事件冒泡中断（某个 handler 返回 true 停止传播）
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useStdin } from 'ink';

/**
 * Key - 按键结构
 * @property name - 按键名称，如 'return', 'backspace', 'delete'，普通字符为空字符串
 * @property ctrl - 是否按下了 Ctrl 修饰键
 * @property sequence - 原始字符序列
 * @property insertable - 该字符是否可插入到输入框（控制键为 false，普通字符为 true）
 */
export interface Key {
  name: string;
  ctrl: boolean;
  sequence: string;
  insertable: boolean;
}

/**
 * KeypressHandler - 键盘事件处理函数类型
 * @param key - 解析后的按键对象
 * @returns 返回 true 表示事件已被处理，停止传播给其他订阅者
 */
type KeypressHandler = (key: Key) => boolean | void;

/**
 * KeypressContextValue - Context 提供的值类型
 * @property subscribe - 订阅键盘事件
 * @property unsubscribe - 取消订阅
 */
interface KeypressContextValue {
  subscribe: (handler: KeypressHandler) => void;
  unsubscribe: (handler: KeypressHandler) => void;
}

const KeypressContext = createContext<KeypressContextValue | undefined>(
  undefined
);

export function useKeypressContext(): KeypressContextValue {
  const ctx = useContext(KeypressContext);
  if (!ctx) {
    throw new Error('useKeypressContext must be used within KeypressProvider');
  }
  return ctx;
}

// 处理输入, 将原始输入转化为Key对象
function parseKey(data: string): Key {
  if (data === '\r' || data === '\n') {
    return { name: 'return', ctrl: false, sequence: data, insertable: false };
  }
  if (data === '\x7f' || data === '\b') {
    return {
      name: 'backspace',
      ctrl: false,
      sequence: data,
      insertable: false,
    };
  }
  if (data === '\x1b[3~') {
    return { name: 'delete', ctrl: false, sequence: data, insertable: false };
  }

  const ch = data[0];
  const ctrl = ch < ' ' && ch !== '\r' && ch !== '\n';

  if (!ctrl && data.length > 0) {
    return { name: '', ctrl: false, sequence: data, insertable: true };
  }

  return { name: '', ctrl, sequence: data, insertable: false };
}

/**
 * KeypressProvider - 全局键盘事件提供者
 *
 * 工作原理：
 * 1. 在顶层开启终端原始输入模式 (raw mode)，无需按回车立即获取按键
 * 2. 监听 stdin 的 'data' 事件，捕获用户按键
 * 3. 通过 React Context 将按键事件传递给所有订阅的子组件
 * 4. 使用发布-订阅模式，支持多个组件同时监听键盘
 *
 */
export function KeypressProvider({ children }: { children: React.ReactNode }) {
  // 从 Ink 获取终端标准输入和原始模式控制函数
  const { stdin, setRawMode } = useStdin();

  // 使用 ref 存储订阅者集合，避免因组件重渲染而丢失
  // Set 结构确保同一处理函数不会被重复添加
  const subscribers = useRef<Set<KeypressHandler>>(new Set());

  // 订阅键盘事件 - 将处理函数添加到订阅者集合
  const subscribe = useCallback((handler: KeypressHandler) => {
    subscribers.current.add(handler);
  }, []);

  // 取消订阅 - 从订阅者集合移除处理函数
  const unsubscribe = useCallback((handler: KeypressHandler) => {
    subscribers.current.delete(handler);
  }, []);

  // 设置键盘事件监听
  useEffect(() => {
    // 开启原始模式：终端输入立即传递给程序，不等待回车键
    setRawMode(true);

    // 设置 stdin 编码为 UTF-8，正确处理中文等 Unicode 字符
    stdin.setEncoding('utf8');

    // 定义按键事件处理函数
    const onData = (data: string) => {
      // 将原始输入转换为结构化的 Key 对象
      const key = parseKey(data);

      // 遍历所有订阅者，依次调用他们的处理函数
      for (const handler of subscribers.current) {
        // 如果处理函数返回 true，表示事件已被处理，停止传播给其他订阅者
        if (handler(key) === true) {
          break;
        }
      }
    };

    // 监听终端输入事件
    stdin.on('data', onData);

    // 组件卸载时清理：移除事件监听，恢复终端默认模式
    return () => {
      stdin.off('data', onData);
      setRawMode(false);
    };
  }, [stdin, setRawMode]);

  // 通过 Context 提供 subscribe 和 unsubscribe 方法给子组件
  return (
    <KeypressContext.Provider value={{ subscribe, unsubscribe }}>
      {children}
    </KeypressContext.Provider>
  );
}
