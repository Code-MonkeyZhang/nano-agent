import { Box, Text } from 'ink';
import { theme } from '../../themes.js';
import { listSkills } from '../../../skill-pool/store.js';

export function SkillMessage() {
  const skills = listSkills();

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
          <Text key={skill.id} color={theme.text.primary}>
            {`  ${skill.name}`}
          </Text>
        ))
      )}
    </Box>
  );
}
