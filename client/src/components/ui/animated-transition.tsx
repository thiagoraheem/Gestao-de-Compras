import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedTransitionProps {
  children: React.ReactNode;
  animationKey: string;
  className?: string;
  enableAnimation?: boolean;
  duration?: number;
}

export const AnimatedTransition: React.FC<AnimatedTransitionProps> = ({ 
  children, 
  animationKey, 
  className = "",
  enableAnimation = true,
  duration = 0.2
}) => {
  if (!enableAnimation) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animationKey}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          duration,
          ease: "easeInOut"
        }}
        layout
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  enableAnimation?: boolean;
  isMoving?: boolean;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = "",
  enableAnimation = true,
  isMoving = false
}) => {
  if (!enableAnimation) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        scale: isMoving ? 1.02 : 1,
        boxShadow: isMoving 
          ? "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          : "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface AnimatedColumnProps {
  children: React.ReactNode;
  className?: string;
  enableAnimation?: boolean;
  isOver?: boolean;
}

export const AnimatedColumn: React.FC<AnimatedColumnProps> = ({
  children,
  className = "",
  enableAnimation = true,
  isOver = false
}) => {
  if (!enableAnimation) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      layout
      animate={{
        backgroundColor: isOver 
          ? "rgba(59, 130, 246, 0.05)" 
          : "transparent",
        borderColor: isOver 
          ? "rgba(59, 130, 246, 0.2)" 
          : "rgba(229, 231, 235, 1)"
      }}
      transition={{
        duration: 0.2,
        ease: "easeInOut"
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};