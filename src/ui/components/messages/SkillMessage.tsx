import { Box, Text } from 'ink';
import { theme } from '../../themes.js';
import type { AgentCore } from '../../../agent.js';

interface SkillMessageProps {
  agent: AgentCore;
}

export function SkillMessage({ agent }: SkillMessageProps) {
  const skills = agent.listSkills();

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderColor={theme.border.default}
      borderStyle="round"
      paddingX={1}
    >
      <Text bold color={theme.text.accent}>
        Available Skills
      </Text>
      <Box height={1} />
      {skills.length === 0 ? (
        <Text color={theme.text.secondary}>No skills available</Text>
      ) : (
        skills.map((skill) => (
          <Text key={skill} color={theme.text.primary}>
            {`  ${skill}`}
          </Text>
        ))
      )}
    </Box>
  );
}
